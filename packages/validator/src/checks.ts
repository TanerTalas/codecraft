/**
 * Şemanın ve tsc'nin yapısal olarak yakalayamadığı kontroller.
 * Saf fonksiyonlar, model çağrısı yok (CLAUDE.md, mimari kural 3).
 *
 * Var olma sebebi ölçüm: 30-08-2026'da doğrulamayı geçmiş bir paket oyuna
 * yüklendi ve dört sınıf hata çıktı (docs/VALIDATION-LIMITS.md). Üçü burada
 * kontrol ediliyor:
 *
 *   checkIdentities  A · referans verilen kimlik gerçekten var mı
 *   checkFileNames   B · dosya adı ile içerik arasındaki kural
 *   checkPatterns    D · geçerli ama amaçlanmayan kod kalıpları
 *
 * C sınıfı (asset referansı) burada yok: kaynak paketi üretmek bir kapsam
 * kararı, doğrulama sorunu değil (docs/VALIDATION-LIMITS.md C).
 *
 * Bu fonksiyonlar hem evals runner'ı hem Aşama 3'ün üretim döngüsü tarafından
 * çağrılır — mantık tek yerde durur.
 */
import { basename } from "node:path";

import { lookup, normalizeId } from "@codecraft/knowledge";

/** Üretilen paketin tek dosyası. path paket köküne göreli: "recipes/ruby.json". */
export type PackFile = {
  path: string;
  content: string;
};

export type Finding = {
  /** Hangi kontrol: "identity" · "filename" · "pattern:<ad>" */
  check: string;
  /** error sonucu düşürür, warning düşürmez. */
  severity: "error" | "warning";
  /** Bulgunun çıktığı paket içi dosya yolu. */
  path?: string;
  message: string;
  /** Kuralın kanıtı — hangi ölçüme dayanıyor. */
  evidence: string;
};

export type CheckResult = {
  ok: boolean;
  findings: Finding[];
};

const LIMITS = "docs/VALIDATION-LIMITS.md";

const toResult = (findings: Finding[]): CheckResult => ({
  ok: findings.every((finding) => finding.severity !== "error"),
  findings,
});

// --------------------------------------------------------------------------
// A · kimlik referansları
// --------------------------------------------------------------------------

/**
 * Kimlik kümeleri ayrı tutulur çünkü aynı metin farklı kümelerde farklı şey
 * demek: "codecraft:ruby_block" hem tarifin kendi kimliği hem de tarifin
 * sonucundaki item olabilir, ve tarifin kimliği item'ı var etmez. Oyun tam
 * bu yüzden hata verdi (docs/VALIDATION-LIMITS.md A).
 */
type DeclaredKind = "thing" | "feature" | "recipe";

/** Referansın hangi kümede aranacağı. */
type RefKind = "thing" | "entity" | "feature";

type Reference = {
  id: string;
  kind: RefKind;
  path: string;
  /** Referansın JSON içindeki yeri, hata mesajında gösterilir. */
  where: string;
};

/** Root anahtarı -> ne tanımlıyor. */
const DECLARES: Record<string, DeclaredKind> = {
  "minecraft:block": "thing",
  "minecraft:item": "thing",
  "minecraft:entity": "thing",
};

/**
 * Feature dosyalarının root anahtarı sabit değil, tipine göre değişiyor
 * (minecraft:ore_feature, minecraft:scatter_feature, minecraft:aggregate_feature…).
 * feature_rules bunun dışında: o bir kural, feature değil.
 */
const isFeatureRoot = (key: string): boolean =>
  key.startsWith("minecraft:") && key.endsWith("_feature") && key !== "minecraft:feature_rules";

const isRecipeRoot = (key: string): boolean => key.startsWith("minecraft:recipe_");

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** "minecraft:planks:2" -> "minecraft:planks". İki parçalıysa dokunulmaz. */
function trimData(id: string): string {
  const parts = id.split(":");
  return parts.length > 2 ? parts.slice(0, 2).join(":") : id;
}

/**
 * Item referansı üç biçimde geliyor: düz metin, {item}, ya da ikisinin dizisi.
 * {tag: …} atlanıyor — etiket indeksimiz yok, uydurma kontrol yapılmaz.
 *
 * Eski biçim "minecraft:planks:2" gibi veri değeri de taşıyabiliyor; üçüncü
 * parça atılır, kimlik ilk iki parçadır.
 */
function collectItemIds(value: unknown, where: string, out: { id: string; where: string }[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, i) => collectItemIds(entry, `${where}/${i}`, out));
    return;
  }

  const direct = asString(value);
  if (direct !== null) {
    out.push({ id: trimData(direct), where });
    return;
  }

  const object = asObject(value);
  if (object === null) return;
  if (object["tag"] !== undefined) return;

  const item = asString(object["item"]);
  if (item !== null) out.push({ id: trimData(item), where: `${where}/item` });
}

/**
 * Bir tarif dosyasının referans verdiği item'lar. Alan adları tarif tipine göre
 * değişiyor: shaped "key", shapeless "ingredients", furnace "input"/"output",
 * brewing ayrıca "reagent".
 */
function collectRecipeRefs(body: JsonObject, root: string, path: string, out: Reference[]): void {
  const push = (value: unknown, field: string): void => {
    const found: { id: string; where: string }[] = [];
    collectItemIds(value, `/${root}/${field}`, found);
    for (const { id, where } of found) out.push({ id, kind: "thing", path, where });
  };

  push(body["result"], "result");
  push(body["ingredients"], "ingredients");
  push(body["input"], "input");
  push(body["output"], "output");
  push(body["reagent"], "reagent");

  const key = asObject(body["key"]);
  if (key !== null) {
    for (const [slot, value] of Object.entries(key)) push(value, `key/${slot}`);
  }
}

type ParsedFile = { file: PackFile; root: string; body: JsonObject };

/** JSON dosyalarını ayrıştırır. Ayrıştırılamayan sessizce atlanmaz, uyarı üretir. */
function parseJsonFiles(files: readonly PackFile[]): {
  parsed: ParsedFile[];
  findings: Finding[];
} {
  const parsed: ParsedFile[] = [];
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;

    let value: unknown;
    try {
      value = JSON.parse(file.content);
    } catch {
      findings.push({
        check: "identity",
        severity: "warning",
        path: file.path,
        message: "JSON ayrıştırılamadı, kontrol bu dosyada koşmadı",
        evidence: "validateJson aynı hatayı ayrıntısıyla raporluyor",
      });
      continue;
    }

    const object = asObject(value);
    if (object === null) continue;

    for (const [root, body] of Object.entries(object)) {
      const bodyObject = asObject(body);
      if (bodyObject !== null) parsed.push({ file, root, body: bodyObject });
    }
  }

  return { parsed, findings };
}

const identifierOf = (body: JsonObject): string | null =>
  asString(asObject(body["description"])?.["identifier"]);

export type IdentityOptions = {
  /** data/ içindeki sürüm. Verilmezse en yenisi. */
  version?: string;
};

/**
 * A sınıfı: referans verilen kimlik gerçekten var mı.
 *
 * İki kaynak var ve ikisi de kesin:
 *
 *   Paketin kendi tanımladıkları  Dosyalardan çıkarılır, tam liste.
 *   Vanilla kimlikler             data/<sürüm>/ indeksleri, lookup ile.
 *
 * Kural namespace'e göre ayrılıyor çünkü kesinlik oradan geliyor:
 *
 *   minecraft: dışı namespace  Onu ancak paketin kendisi tanımlayabilir.
 *                              Tanımlı değilse kesinlikle hata.
 *   minecraft: namespace'i     blok/item/entity indeksleri tam, lookup karar verir.
 *
 * Tek boşluk vanilla feature'lar: data/<sürüm>/features.json yapı (structure)
 * feature'larını tutuyor (17 kayıt), ore/scatter gibi yerleştirme feature'larını
 * değil. O yüzden "minecraft:" namespace'li bir places_feature doğrulanamıyor ve
 * uyarı olarak raporlanıyor — sessizce geçilmiyor.
 */
export async function checkIdentities(
  files: readonly PackFile[],
  options: IdentityOptions = {},
): Promise<CheckResult> {
  const { parsed, findings } = parseJsonFiles(files);

  const declared: Record<DeclaredKind, Set<string>> = {
    thing: new Set(),
    feature: new Set(),
    recipe: new Set(),
  };
  const references: Reference[] = [];

  for (const { file, root, body } of parsed) {
    const declaredKind = DECLARES[root] ?? (isFeatureRoot(root) ? "feature" : null);
    if (declaredKind !== null) {
      const id = identifierOf(body);
      if (id !== null) declared[declaredKind].add(normalizeId(id));
      continue;
    }

    if (isRecipeRoot(root)) {
      const id = identifierOf(body);
      if (id !== null) declared.recipe.add(normalizeId(id));
      collectRecipeRefs(body, root, file.path, references);
      continue;
    }

    if (root === "minecraft:spawn_rules") {
      // Spawn kuralının identifier'ı kendi kimliği değil, kural yazdığı
      // entity'nin kimliği. Var olmayan bir entity'ye kural yazılamaz.
      const id = identifierOf(body);
      if (id !== null) {
        references.push({
          id,
          kind: "entity",
          path: file.path,
          where: `/${root}/description/identifier`,
        });
      }
      continue;
    }

    if (root === "minecraft:feature_rules") {
      const places = asString(asObject(body["description"])?.["places_feature"]);
      if (places !== null) {
        references.push({
          id: places,
          kind: "feature",
          path: file.path,
          where: `/${root}/description/places_feature`,
        });
      }
    }
  }

  for (const reference of references) {
    const id = normalizeId(reference.id);
    const custom = !id.startsWith("minecraft:");

    if (reference.kind === "feature") {
      if (declared.feature.has(id)) continue;
      findings.push({
        check: "identity",
        severity: custom ? "error" : "warning",
        path: reference.path,
        message: custom
          ? `${reference.where}: "${id}" hiçbir feature dosyasında tanımlı değil`
          : `${reference.where}: "${id}" doğrulanamadı — vanilla feature indeksi eksik`,
        evidence: `${LIMITS} · A ("No definition found for feature")`,
      });
      continue;
    }

    if (declared.thing.has(id)) continue;

    if (custom) {
      findings.push({
        check: "identity",
        severity: "error",
        path: reference.path,
        message:
          `${reference.where}: "${id}" pakette tanımlı değil. ` +
          "minecraft: dışı bir kimliği ancak paketin kendisi tanımlayabilir",
        evidence: `${LIMITS} · A ("The Item … is missing or invalid")`,
      });
      continue;
    }

    const found = await lookup(id, {
      version: options.version,
      ...(reference.kind === "entity" ? { kind: "entity" as const } : {}),
    });
    if (found.found) continue;

    findings.push({
      check: "identity",
      severity: "error",
      path: reference.path,
      message: `${reference.where}: "${id}" ${found.version} sürümünde yok`,
      evidence: `${LIMITS} · A`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// B · dosya adı ile içerik arasındaki kurallar
// --------------------------------------------------------------------------

/**
 * B sınıfı: hiçbir JSON şemasının yakalayamayacağı kural türü — şema dosyanın
 * içeriğini görür, adını görmez.
 *
 * Burada YALNIZCA kanıtı olan kural kodlanıyor. Feature rule dosyasının adının
 * identifier'ın namespace'siz hâline eşit olması gerektiği 30-08-2026'da oyunda
 * ölçüldü: oyun reddetti, dosya adı düzeltilince hata kayboldu
 * (docs/VALIDATION-LIMITS.md B).
 *
 * Başka dosya tipleri için benzer kurallar olabilir ama ölçülmedi. Ölçülmemiş
 * kural buraya yazılmaz — bu aracın var olma sebebi tam olarak tahmine dayalı
 * çıktı üretmemek.
 */
export function checkFileNames(files: readonly PackFile[]): CheckResult {
  const { parsed, findings } = parseJsonFiles(files);

  for (const { file, root, body } of parsed) {
    if (root !== "minecraft:feature_rules") continue;

    const id = identifierOf(body);
    if (id === null) continue;

    const expected = normalizeId(id).split(":").slice(1).join(":");
    const actual = basename(file.path).replace(/\.json$/, "");
    if (actual === expected) continue;

    findings.push({
      check: "filename",
      severity: "error",
      path: file.path,
      message:
        `feature rule dosya adı "${actual}", identifier "${id}" ` +
        `olduğu için "${expected}.json" olmalı`,
      evidence: `${LIMITS} · B ("does not match filename")`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// D · geçerli ama amaçlanmayan
// --------------------------------------------------------------------------

type Pattern = {
  /** Kalıp adı, vaka dosyasında "pattern:<ad>" diye istenir. */
  name: string;
  /** Kalıbı arar. Bulursa mesaj döner, bulmazsa null. */
  find: (code: string) => string | null;
  evidence: string;
};

/**
 * `subscribe(` sonrasındaki argüman metnini parantez dengeleyerek çıkarır.
 * Yaklaşık bir okuma: metin sabitlerinin içindeki parantezleri de sayar. AST
 * kullanılmıyor çünkü kurulu typescript@7'nin JS yüzeyi "unstable/" altında
 * (bkz. script.ts). Yanlış tarafa düşerse kalıbı bulamaz — uydurma bulgu
 * üretmez, yani hata yönü güvenli tarafta.
 */
function argumentText(code: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < code.length; i += 1) {
    const char = code[i];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(openIndex + 1, i);
    }
  }
  return code.slice(openIndex + 1);
}

const WORLD_LOAD = /\bworldLoad\s*\.\s*subscribe\s*\(/g;

/**
 * Kalıp tablosu. Her kalıbın kanıtı var — "böyle olsa iyi olur" maddesi yok.
 * Aşama 3 buraya kalıp ekledikçe prompt da aynı listeden beslenir.
 */
const PATTERNS: Pattern[] = [
  {
    name: "welcome-on-player-spawn",
    evidence: `${LIMITS} · D (oyunda ölçüldü: olay tetikleniyor, mesaj kimseye ulaşmıyor)`,
    find: (code) => {
      WORLD_LOAD.lastIndex = 0;
      for (let match = WORLD_LOAD.exec(code); match !== null; match = WORLD_LOAD.exec(code)) {
        const body = argumentText(code, match.index + match[0].length - 1);
        if (/\bsendMessage\s*\(/.test(body)) {
          return (
            "worldLoad aboneliğinde sendMessage var: olay tetikleniyor ama o anda " +
            "mesajı alacak oyuncu yok. Karşılama mesajı playerSpawn ile yazılmalı " +
            "(event.initialSpawn kontrolüyle)"
          );
        }
      }
      return null;
    },
  },
];

/** Bu sürümde tanınan kalıpların adları. */
export const patternNames = (): string[] => PATTERNS.map((pattern) => pattern.name);

export type PatternOptions = {
  /** Bulgulara yazılacak dosya yolu. */
  path?: string;
  /** Verilirse yalnızca bu adlardaki kalıplar koşar. */
  only?: string[];
};

/**
 * D sınıfı: kod her ölçüte göre doğru, yanlış olan niyetle sonuç arasındaki fark.
 * Ne derleyici ne şema yakalayabilir; yakalanabilmesi için kalıbın bilinmesi
 * gerekiyor (docs/VALIDATION-LIMITS.md D).
 *
 * Bilinmeyen kalıp adı sessizce atlanmaz, hata fırlatır — vaka dosyasındaki bir
 * yazım hatası "kontrol geçti" gibi görünmesin.
 */
export function checkPatterns(code: string, options: PatternOptions = {}): CheckResult {
  const selected =
    options.only === undefined
      ? PATTERNS
      : options.only.map((name) => {
          const pattern = PATTERNS.find((candidate) => candidate.name === name);
          if (pattern === undefined) {
            throw new Error(
              `Bilinmeyen kalıp: "${name}". Tanınanlar: ${patternNames().join(", ")}`,
            );
          }
          return pattern;
        });

  const findings: Finding[] = [];
  for (const pattern of selected) {
    const message = pattern.find(code);
    if (message === null) continue;
    findings.push({
      check: `pattern:${pattern.name}`,
      severity: "error",
      ...(options.path === undefined ? {} : { path: options.path }),
      message,
      evidence: pattern.evidence,
    });
  }

  return toResult(findings);
}
