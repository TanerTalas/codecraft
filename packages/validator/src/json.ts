/**
 * JSON doğrulama. Saf fonksiyon, hiçbir model çağrısı yok
 * (CLAUDE.md, mimari kural 3).
 *
 * Şema kaynağı Blockception'ın derlenmiş çıktısı: her dosya tek başına yeterli,
 * tüm $ref'ler dosya içi. Gerekçe ve ölçüm docs/SOURCES.md içinde.
 */
import { readFile } from "node:fs/promises";

import { Ajv, type AnySchema, type ErrorObject, type ValidateFunction } from "ajv";
import formats from "ajv-formats";

import { resolveVersion } from "@codecraft/knowledge";

import { resolveType } from "./schema-map.ts";

/**
 * `parse`  — içerik geçerli JSON değil, şemaya hiç gelmedi
 * `schema` — şema ihlali
 */
export type JsonErrorKind = "parse" | "schema";

export type JsonError = {
  kind: JsonErrorKind;
  /** Şema hataları için JSON pointer ("/header/min_engine_version"). */
  path: string;
  message: string;
  /** Hangi şema anahtarı ihlal edildi: type, required, enum … */
  keyword?: string;
};

export type JsonResult = {
  ok: boolean;
  version: string;
  /** Çözümlenen kanonik tip. */
  type: string;
  /** Kullanılan şemanın data/blockception/ köküne göreli yolu. */
  schema: string;
  errors: JsonError[];
};

/**
 * ajv ayarları — üçü de ölçülmüş sebeplerle:
 *
 * strict: false        Blockception "defaultSnippets", Mojang "x-ordinal-index"
 *                      gibi standart dışı anahtarlar kullanıyor; katı kip patlar.
 * allErrors: true      Aşama 3'ün retry döngüsü modele tek hatayı değil hepsini
 *                      verecek. Tek hatayla dönmek bir sonraki denemede ikinci
 *                      hatanın çıkmasına yol açar.
 * unicodeRegExp: false docs/SOURCES.md'nin ölçtüğü madde: varsayılan ayarda
 *                      `pattern` içindeki \- kaçışı 5 Mojang şemasını derletmiyor.
 */
/**
 * ajv 8'de yerleşik `format` yok, ajv-formats ekliyor. Derlenmiş şemalarda geçen
 * biçimler ölçüldü (30-08-2026): uuid (2) ve uri (2) standart — bunlar gerçekten
 * doğrulanıyor. color-hex (25), molang (14) ve colox-hex (3, upstream'de yazım
 * hatası) Blockception'a özgü; ajv onları yok sayıyor ve her derlemede uyarı
 * basıyor. Kendi tanımlarını yazmak uydurma doğrulama olurdu, o yüzden sadece
 * bu uyarı susturuluyor — diğer ajv uyarıları geçmeye devam ediyor.
 */
const IGNORED_FORMAT_WARNING = /^unknown format /;

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  unicodeRegExp: false,
  logger: {
    log: console.log.bind(console),
    warn: (...args: unknown[]) => {
      if (typeof args[0] === "string" && IGNORED_FORMAT_WARNING.test(args[0])) return;
      console.warn(...args);
    },
    error: console.error.bind(console),
  },
});
// ajv-formats CommonJS: module.exports hem eklentinin kendisi hem de .default
// olarak duruyor. TS tarafında çağrılabilir olan .default.
formats.default(ajv);

const compiled = new Map<string, ValidateFunction>();

async function getValidator(path: string, type: string): Promise<ValidateFunction> {
  const cached = compiled.get(type);
  if (cached !== undefined) return cached;
  const schema = JSON.parse(await readFile(path, "utf8")) as AnySchema;
  const validate = ajv.compile(schema);
  compiled.set(type, validate);
  return validate;
}

/** JSON.parse hatasından satır/sütun bilgisini korur, kalanını olduğu gibi geçirir. */
function parseError(error: unknown): JsonError {
  const message = error instanceof Error ? error.message : String(error);
  return { kind: "parse", path: "", message };
}

/**
 * Ajv'nin mesajını eyleme dönüştürülebilir hâle getirir.
 *
 * İki keyword tek başına işe yaramıyordu ve ikisi de üretim döngüsünü boşa
 * düşürüyordu — model hatayı okuyup neyi düzelteceğini bilemiyor:
 *
 *   "must NOT have additional properties"   hangi alan fazla?
 *   "must be equal to one of the allowed"   hangi değerler geçerli?
 *
 * Ölçüldü (30-08-2026, `ore-gen-01`): model `minecraft:ore_feature` içine
 * `places_block` yazdı, ajv "must NOT have additional properties" dedi, retry
 * aynı hatayı iki denemede de düzeltemedi. Alan adı verilseydi düzeltilebilirdi.
 *
 * Ajv bu bilgiyi zaten `params` içinde taşıyor; yalnızca mesaja geçmiyordu.
 */
function describe(error: ErrorObject): string {
  const base = error.message ?? error.keyword;
  const params = error.params as Record<string, unknown>;

  if (error.keyword === "additionalProperties") {
    const name = params["additionalProperty"];
    if (typeof name === "string") return `${base}: "${name}"`;
  }

  if (error.keyword === "enum") {
    const allowed = params["allowedValues"];
    // Uzun enum listeleri (blok kimlikleri gibi) mesajı okunmaz yapardı.
    if (Array.isArray(allowed) && allowed.length > 0 && allowed.length <= 12) {
      return `${base}: ${allowed.map((value) => JSON.stringify(value)).join(", ")}`;
    }
  }

  return base;
}

/**
 * Aynı yol için aynı mesaj birden çok kez çıkabiliyor (anyOf/oneOf dalları).
 * Sıra korunarak tekilleştirilir.
 */
function toErrors(errors: readonly ErrorObject[]): JsonError[] {
  const seen = new Set<string>();
  const out: JsonError[] = [];
  for (const error of errors) {
    const path = error.instancePath;
    const message = describe(error);
    const key = `${path}\u0000${error.keyword}\u0000${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "schema", path, message, keyword: error.keyword });
  }
  return out;
}

/**
 * İçeriği verilen doküman tipinin şemasına karşı doğrular.
 *
 * @param content Metin ya da ayrıştırılmış değer. Metin verilirse ayrıştırma
 *                hatası da yakalanır — Bedrock yazarlarının en sık hatası
 *                fazladan virgül ve o hata şemaya hiç ulaşmaz.
 * @param type    Kanonik tip ("behavior/blocks/blocks"), kısaltması
 *                ("behavior/blocks") veya bir dosya yolu ("BP/blocks/ruby.json").
 * @param version data/ içindeki sürüm. Verilmezse en yenisi.
 */
export async function validateJson(
  content: string | unknown,
  type: string,
  version?: string,
): Promise<JsonResult> {
  const { entry, path } = await resolveType(type, version);
  const { version: resolved } = await resolveVersion(version);

  let value: unknown;
  if (typeof content === "string") {
    try {
      value = JSON.parse(content);
    } catch (error) {
      return {
        ok: false,
        version: resolved,
        type: entry.type,
        schema: entry.schema,
        errors: [parseError(error)],
      };
    }
  } else {
    value = content;
  }

  const validate = await getValidator(path, entry.type);
  const ok = validate(value) as boolean;

  return {
    ok,
    version: resolved,
    type: entry.type,
    schema: entry.schema,
    errors: ok ? [] : toErrors(validate.errors ?? []),
  };
}
