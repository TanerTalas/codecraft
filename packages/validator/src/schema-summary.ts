/**
 * Şema özeti — ham şema yerine hedefe yönelik cevap.
 *
 * VAR OLMA SEBEBİ ÖLÇÜM. MCP araç çıktısının bir bütçesi var ve derlenmiş
 * şemalar onu rahat aşıyor: `entities.json` 585.237 bayt, `commands.json`
 * 650.454. Ham şema döndürmek teknik olarak mümkün ama pratikte imkânsız.
 *
 * Ham şema zaten okunabilir de değil: "compiled" derlemesi tanım adlarını tek
 * harfe indirmiş (`#/definitions/A`, `#/definitions/B`). Yani `definitions`
 * bloğunu olduğu gibi vermek büyük OLMASA bile işe yaramazdı.
 *
 * Buna karşılık şemaların yapısı düzenli ve bu özetlemeyi kolaylaştırıyor —
 * ölçüldü (01-09-2026):
 *
 *   · Bütün $ref'ler İÇSEL. blocks.json'daki 76 ref'in 76'sı "#/definitions/…".
 *     Alt ağaç çıkarmak için başka dosya okumak gerekmiyor.
 *   · Bütün tipler aynı iskelette: required = [format_version, minecraft:<şey>],
 *     properties iki-üç alan, ağırlığın tamamı definitions içinde.
 *   · Kök düğüm özetleri 1 KB'ın altında (entities 583 B, blocks 597 B).
 *     Patlama derinlerde: minecraft:entity/components düğümünde 390 alan var
 *     ve tam özeti 59.763 bayt.
 *
 * O yüzden özet KADEMELİ daralıyor (bkz. Detail). Sessiz kesme yok: hangi
 * basamağa inildiği `truncated` alanında yazıyor, çünkü modelin neyi
 * göremediğini bilmesi gerekiyor.
 *
 * Neden validator'da, MCP'de değil: saf fonksiyon, model çağrısı yok
 * (mimari kural 3), ve resolveType zaten burada. context.ts de listTypes ile
 * schemaFormatVersions'ı prompt için çekiyor — bu özet ileride oraya da girebilir.
 */
import { readFile } from "node:fs/promises";

import { loadCatalog, resolveType } from "./schema-map.ts";

/** $ref zincirinde ve ağaç yürüyüşünde döngü koruması. */
const MAX_DEPTH = 30;

/** Açıklamalar bu uzunlukta kırpılıyor. Bir cümle yeter, paragraf yemez. */
const DESCRIPTION_LIMIT = 160;

/** enum listesi bu kadar öğeye kadar yazılıyor — json.ts'teki describe() ile aynı sınır. */
const ENUM_LIMIT = 12;

/**
 * Özetin hangi ayrıntı seviyesinde döndüğü.
 *
 *   full             ad + tip + zorunluluk + açıklama + enum
 *   no-descriptions  açıklamalar düştü
 *   names-only       yalnızca ad listesi — NE OLDUĞU eksik, NELERİN VAR OLDUĞU tam
 *   clipped          ad listesi de sığmadı, kesildi
 *
 * Sıra bilerek böyle: "ilk 60 alanı göster, sus" YAPILMIYOR. O yol modele
 * geri kalan 330 alanın var olmadığını düşündürürdü.
 */
export type Detail = "full" | "no-descriptions" | "names-only" | "clipped";

export type SchemaProperty = {
  name: string;
  /** JSON Schema tipi. Birden fazlaysa "a|b", oneOf/anyOf ise "oneOf". */
  type?: string;
  /**
   * Yalnızca zorunlu alanlarda var (hasChildren ile aynı kalıp).
   *
   * Her alana `required: false` yazmak ölçülmüş bir israftı: 390 alanlı
   * minecraft:entity/components düğümünde özet 22.528 bayttan 15.898 bayta
   * indi. Zorunluların tam listesi zaten SchemaSummary.required.
   */
  required?: boolean;
  description?: string;
  /** En fazla ENUM_LIMIT öğe; daha uzunsa hiç yazılmıyor (okunmaz olurdu). */
  enum?: unknown[];
  /** Altında alan var — `path` ile inilebilir. */
  hasChildren?: boolean;
};

export type SchemaSummary = {
  /** resolveType'ın çözdüğü kanonik tip adı. */
  type: string;
  version: string;
  /** data/blockception/ köküne göreli şema yolu. */
  schema: string;
  /** İnilen alt yol. Kök için "". */
  path: string;
  title?: string;
  description?: string;
  required: string[];
  /** Bu şemanın kabul ettiği format_version değerleri. Kısıtlamıyorsa boş. */
  formatVersions: string[];
  properties: SchemaProperty[];
  detail: Detail;
  /**
   * Daralma olduysa ne olduğu ve neden. Daralma yoksa alan hiç yok.
   * Sessiz kesme yapılmıyor — model neyin eksik olduğunu bilmeli.
   */
  truncated?: string;
};

export type SummaryOptions = {
  version?: string;
  /**
   * Alt yol, "/" ile: "minecraft:entity/components/minecraft:health".
   * Çözülemezse HATA — yakın bir düğüme düşmek yok (resolveType ile aynı kural).
   */
  path?: string;
  /** Bayt tavanı. Aşılırsa özet kademeli daralır. Verilmezse tam özet döner. */
  limit?: number;
};

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * `#/definitions/X` zincirini çözer.
 *
 * Yalnızca içsel ref işleniyor. Dış ref bugün yok (ölçüldü: blocks.json'da
 * 76/76 içsel) ama çıkarsa çözülmeden bırakılıyor — sessizce yanlış düğüm
 * döndürmektense çözülmemiş ref görünsün.
 */
function deref(node: unknown, root: Node): unknown {
  let current = node;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (!isNode(current)) return current;
    const ref = current["$ref"];
    if (typeof ref !== "string" || !ref.startsWith("#/")) return current;

    let target: unknown = root;
    for (const segment of ref.slice(2).split("/")) {
      if (!isNode(target)) return current;
      target = target[segment];
    }
    if (target === undefined) return current;
    current = target;
  }
  return current;
}

/** Bir düğümün doğrudan çocukları: properties, yoksa additionalProperties. */
function childrenOf(node: unknown, root: Node): Node | null {
  const resolved = deref(node, root);
  if (!isNode(resolved)) return null;

  const properties = resolved["properties"];
  if (isNode(properties)) return properties;

  const additional = resolved["additionalProperties"];
  if (isNode(additional)) {
    const nested = deref(additional, root);
    if (isNode(nested) && isNode(nested["properties"])) return nested["properties"];
  }
  return null;
}

/** "a/b/c" yolunu izler. Çözemezse hata — en yakına düşmek yok. */
function walk(root: Node, path: string): { node: unknown; walked: string } {
  const segments = path.split("/").filter((segment) => segment !== "");
  let node: unknown = root;
  const walked: string[] = [];

  for (const segment of segments) {
    const children = childrenOf(node, root);
    const next = children?.[segment];
    if (next === undefined) {
      const available = children === null ? [] : Object.keys(children).slice(0, 20);
      throw new Error(
        `Şema yolu çözümlenemedi: "${path}". ` +
          `"${walked.join("/") || "(kök)"}" altında "${segment}" yok. ` +
          (available.length > 0 ? `Oradaki alanlar: ${available.join(", ")}` : "Orada alan yok."),
      );
    }
    node = next;
    walked.push(segment);
  }

  return { node: deref(node, root), walked: walked.join("/") };
}

const clip = (text: string): string =>
  text.length <= DESCRIPTION_LIMIT ? text : `${text.slice(0, DESCRIPTION_LIMIT - 1)}…`;

function typeOf(node: Node): string | undefined {
  const type = node["type"];
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.map(String).join("|");
  if (Array.isArray(node["oneOf"]) || Array.isArray(node["anyOf"])) return "oneOf";
  return undefined;
}

function describeProperty(
  name: string,
  spec: unknown,
  required: ReadonlySet<string>,
  root: Node,
): SchemaProperty {
  const node = deref(spec, root);
  const property: SchemaProperty = { name };
  if (required.has(name)) property.required = true;
  if (!isNode(node)) return property;

  const type = typeOf(node);
  if (type !== undefined) property.type = type;

  const text = node["description"] ?? node["title"];
  if (typeof text === "string" && text !== "") property.description = clip(text);

  const values = node["enum"];
  if (Array.isArray(values) && values.length > 0 && values.length <= ENUM_LIMIT) {
    property.enum = values;
  }

  if (childrenOf(node, root) !== null) property.hasChildren = true;
  return property;
}

/**
 * Bu şemanın kabul ettiği format_version değerleri.
 *
 * schema-map.ts'teki schemaFormatVersions() bütün katalogu tarıyor — her
 * şemayı okuyup ağacını geziyor. Tek tip için o pahalı, o yüzden aynı iş
 * burada tek belge üzerinde yapılıyor. Arama mantığı aynı: değerler çoğu zaman
 * oneOf dalları içinde duruyor, düz bakmak yetmiyor.
 */
function collectFormatVersions(node: unknown, out: Set<string>, depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) collectFormatVersions(child, out, depth + 1);
    return;
  }

  const record = node as Node;
  const properties = record["properties"];
  if (isNode(properties)) {
    const field = properties["format_version"];
    if (isNode(field)) {
      if (Array.isArray(field["enum"])) for (const value of field["enum"]) out.add(String(value));
      if (field["const"] !== undefined) out.add(String(field["const"]));
    }
  }

  for (const child of Object.values(record)) collectFormatVersions(child, out, depth + 1);
}

const size = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

/**
 * Bir doküman tipinin (ya da altındaki bir yolun) özetini çıkarır.
 *
 * `limit` verilirse sonuç o baytın altına indirilene kadar kademeli daralır.
 * Verilmezse tam özet döner — çağıran bütçesini kendi bilir.
 */
export async function summarizeSchema(
  type: string,
  options: SummaryOptions = {},
): Promise<SchemaSummary> {
  const { entry, path: file } = await resolveType(type, options.version);
  // resolveType sürümü döndürmüyor; katalog zaten önbellekli, ikinci çağrı bedava.
  const { version } = await loadCatalog(options.version);
  const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isNode(parsed)) throw new Error(`Şema bir nesne değil: ${entry.schema}`);
  const root = parsed;

  const { node, walked } = walk(root, options.path ?? "");

  const formatVersions = new Set<string>();
  collectFormatVersions(root, formatVersions, 0);

  const target = isNode(node) ? node : {};
  const required = new Set(
    Array.isArray(target["required"])
      ? (target["required"] as unknown[]).filter((value): value is string => typeof value === "string")
      : [],
  );
  const children = childrenOf(target, root) ?? {};

  const summary: SchemaSummary = {
    type: entry.type,
    version,
    schema: entry.schema,
    path: walked,
    required: [...required].sort(),
    formatVersions: [...formatVersions].sort(),
    properties: Object.entries(children).map(([name, spec]) =>
      describeProperty(name, spec, required, root),
    ),
    detail: "full",
  };

  const title = target["title"];
  if (typeof title === "string" && title !== "") summary.title = title;
  const description = target["description"];
  if (typeof description === "string" && description !== "") {
    summary.description = clip(description);
  }

  return narrow(summary, options.limit);
}

/**
 * Tavana sığana kadar kademeli daraltır.
 *
 * Her basamak `truncated` alanında adıyla bildiriliyor. Basamak atlanmıyor:
 * önce açıklamalar, sonra ad listesi, en son kesme. Ad listesi basamağı
 * ölçülmüş bir kazanç — 390 alan tam özette 59.763 bayt, ad listesinde 12.383.
 */
function narrow(summary: SchemaSummary, limit?: number): SchemaSummary {
  if (limit === undefined || size(summary) <= limit) return summary;

  const total = summary.properties.length;

  const withoutDescriptions: SchemaSummary = {
    ...summary,
    detail: "no-descriptions",
    truncated:
      `${total} alanın açıklamaları çıkarıldı (bayt tavanı). ` +
      "Bir alanın ayrıntısı için path ile in.",
    properties: summary.properties.map(({ name, type, required, hasChildren }) => {
      const property: SchemaProperty = { name };
      if (type !== undefined) property.type = type;
      if (required === true) property.required = true;
      if (hasChildren === true) property.hasChildren = true;
      return property;
    }),
  };
  if (size(withoutDescriptions) <= limit) return withoutDescriptions;

  const namesOnly: SchemaSummary = {
    ...withoutDescriptions,
    detail: "names-only",
    truncated:
      `${total} alanın yalnızca adı listelendi (bayt tavanı). ` +
      "Hepsi burada; ayrıntı için path ile in.",
    properties: summary.properties.map(({ name, required }) =>
      required === true ? { name, required } : { name },
    ),
  };
  if (size(namesOnly) <= limit) return namesOnly;

  // Son çare. Kaç alandan kaçının göründüğü yazılıyor — eksik olduğu gizlenmiyor.
  let kept = namesOnly.properties.length;
  let clipped = namesOnly;
  while (kept > 0) {
    kept = Math.floor(kept / 2);
    clipped = {
      ...namesOnly,
      detail: "clipped",
      truncated:
        `${total} alandan ${kept} tanesi listelendi, gerisi kesildi (bayt tavanı). ` +
        "Daralt: path ile alt bir düğüme in.",
      properties: namesOnly.properties.slice(0, kept),
    };
    if (size(clipped) <= limit) break;
  }
  return clipped;
}
