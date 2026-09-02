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
 *   · Kökü tamamen boş dönen 7 şema vardı (60'ta), aralarında EN ÇOK
 *     kullanılan tip: general/manifest. Sebep `allOf` ve `if/then/else`;
 *     60 şemada 517 if/then, 18 allOf düğümü var. Ölçüm 01-09-2026, M5 s6.
 *   · Alanlar her zaman `properties` altında DEĞİL. Dizi düğümlerinde
 *     `items` içindeler ve bu yaygın: 60 derlenmiş şemada 618 düğüm `items`
 *     taşıyor, 91'inin arkasında gerçek alanlar var (spawn_rules/conditions
 *     22, blocks/permutations, dialogue/scenes …). Ölçüm 01-09-2026, gerçek oturum ölçümünde (docs/mcp-kullanim.md).
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
  /**
   * Bu düğüm bir DİZİ ve `properties` altındakiler dizinin her ÖĞESİNİN
   * alanları. Dizi olmayan düğümlerde alan hiç yok.
   *
   * Ayrıca yazılıyor çünkü fark dosyayı değiştiriyor: "conditions'ın alanları"
   * ile "conditions'ın her öğesinin alanları" farklı JSON ürettirir.
   */
  arrayItems?: boolean;
  /**
   * Alanlar bu kadar ALTERNATİF biçimden birleştirildi (`oneOf`/`anyOf`).
   * Hepsi aynı anda geçerli olmayabilir; hangisinin geçtiğini validate_json
   * söyler. Zorunlu alanlar kesişimden alınıyor, yani buradaki `required`
   * her dalda zorunlu olanlar.
   */
  oneOfBranches?: number;
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

/** Bir düğümün `required` listesi, dizeye indirgenmiş. */
const requiredOf = (node: Node): string[] =>
  Array.isArray(node["required"])
    ? (node["required"] as unknown[]).filter((value): value is string => typeof value === "string")
    : [];

/** Alanlar ve nereden geldikleri. `fieldsOf` bunu döndürür. */
type Fields = {
  /** Alan adı → şema düğümü. */
  properties: Node;
  required: string[];
  /** Alanlar bir dizinin ÖĞESİNDEN geldi. */
  viaItems: boolean;
  /** Alanlar bu kadar alternatif daldan birleştirildi. Tek biçimliyse yok. */
  branches?: number;
};

/**
 * Alternatif dalları tek bir alan kümesinde birleştirir.
 *
 * Zorunluluk BİRLEŞİM değil KESİŞİM: yalnızca her dalda zorunlu olan alan
 * gerçekten zorunlu. Birleşim alsaydık tek bir dalda zorunlu olan alanı her
 * biçimde zorunlu göstermiş olurduk — modele olmayan bir kısıt dayatırdı.
 */
function mergeBranches(found: Fields[]): Fields {
  const properties: Node = {};
  for (const branch of found) {
    for (const [name, spec] of Object.entries(branch.properties)) {
      if (!(name in properties)) properties[name] = spec;
    }
  }

  const merged: Fields = {
    properties,
    required: found[0]!.required.filter((name) =>
      found.every((branch) => branch.required.includes(name)),
    ),
    viaItems: found.every((branch) => branch.viaItems),
  };
  if (found.length > 1) merged.branches = found.length;
  return merged;
}

/**
 * `allOf` dallarını birleştirir — hepsi AYNI ANDA geçerli.
 *
 * Zorunluluk burada BİRLEŞİM, kesişim değil: allOf'ta her dal ayrı ayrı
 * sağlanmak zorunda, yani bir dalda zorunlu olan alan gerçekten zorunlu.
 * oneOf'un tam tersi ve karıştırılırsa sessizce yanlış cevap verir.
 */
function mergeAll(found: Fields[]): Fields {
  const properties: Node = {};
  const required = new Set<string>();
  for (const branch of found) {
    for (const [name, spec] of Object.entries(branch.properties)) {
      if (!(name in properties)) properties[name] = spec;
    }
    for (const name of branch.required) required.add(name);
  }
  return { properties, required: [...required], viaItems: false };
}

/**
 * Alanların GERÇEKTE durduğu yer — target'ın `properties`'i olmayabilir.
 *
 * Dört yer var, sırayla bakılıyor: `properties`, `additionalProperties`
 * (map düğümleri), `items` (dizi düğümleri), `oneOf`/`anyOf` (alternatif
 * biçimler).
 *
 * SON İKİSİ docs/mcp-kullanim.md ölçümlerinde ÖLÇÜLEREK eklendi. Gerçek bir oturumda model
 * `minecraft:spawn_rules/conditions` yolunu DOĞRU istedi ve eli boş döndü:
 * o düğüm `type: "array"`, kendi `properties`'i yok, 22 spawn koşulu
 * bileşeninin hepsi `items.properties` içinde. Bir alt basamakta aynı şey
 * tekrarlanıyordu — `minecraft:herd` bir `oneOf` ve 6 alanı iki dalın
 * içinde. Araç ikisinde de "burada alan yok" dedi, "bakamıyorum" demedi; bu
 * hatadan kötü, çünkü model o bileşenleri şemadan değil belleğinden yazar.
 * (docs/mcp-kullanim.md, senaryo 1)
 *
 * Kapsam ölçüldü (60 derlenmiş şema, 01-09-2026):
 *
 *   · 618 düğüm `items` taşıyor, 91'inin arkasında gerçek alanlar var
 *   · 436 `oneOf`/`anyOf` düğümünün 144'ü boş dönüyordu ama alanı var;
 *     123'ünde dalların alan kümesi birebir AYNI, 21'inde farklı
 *
 * Tuple biçimi (`items` bir dizi) bilerek DIŞARIDA: 141 tuple düğümünün
 * hiçbirinde alan yok, hepsi koordinat/aralık çifti ([number, number],
 * [string, integer]). Ölçülmemiş kural kodlanmıyor.
 */
function fieldsOf(node: unknown, root: Node, depth = 0): Fields | null {
  if (depth > MAX_DEPTH) return null;
  const resolved = deref(node, root);
  if (!isNode(resolved)) return null;

  const properties = resolved["properties"];
  // Boş bir properties "alan yok" demek, "alanlar burada" demek değil —
  // aşağıdaki basamaklara inebilmek için geçilmesi gerekiyor.
  if (isNode(properties) && Object.keys(properties).length > 0) {
    return { properties, required: requiredOf(resolved), viaItems: false };
  }

  const additional = deref(resolved["additionalProperties"], root);
  if (isNode(additional) && isNode(additional["properties"])) {
    return {
      properties: additional["properties"],
      required: requiredOf(additional),
      viaItems: false,
    };
  }

  const items = resolved["items"];
  if (items !== undefined && !Array.isArray(items)) {
    const inner = fieldsOf(items, root, depth + 1);
    if (inner !== null) return { ...inner, viaItems: true };
  }

  const branches = resolved["oneOf"] ?? resolved["anyOf"];
  if (Array.isArray(branches) && branches.length > 0) {
    const found = branches
      .map((branch) => fieldsOf(branch, root, depth + 1))
      .filter((fields): fields is Fields => fields !== null);
    if (found.length > 0) return mergeBranches(found);
  }

  const all = resolved["allOf"];
  if (Array.isArray(all) && all.length > 0) {
    const found = all
      .map((branch) => fieldsOf(branch, root, depth + 1))
      .filter((fields): fields is Fields => fields !== null);
    if (found.length > 0) return mergeAll(found);
  }

  // Koşullu şema: if/then/else. Dallar ALTERNATİF, o yüzden oneOf gibi
  // birleştiriliyor ve zorunluluk kesişimden alınıyor.
  const conditional = [resolved["then"], resolved["else"]].filter(
    (branch) => branch !== undefined,
  );
  if (conditional.length > 0) {
    const found = conditional
      .map((branch) => fieldsOf(branch, root, depth + 1))
      .filter((fields): fields is Fields => fields !== null);
    if (found.length > 0) return mergeBranches(found);
  }

  return null;
}

/** Bir düğümün doğrudan çocukları. Nerede durduklarını fieldsOf biliyor. */
function childrenOf(node: unknown, root: Node): Node | null {
  return fieldsOf(node, root)?.properties ?? null;
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
        `Schema path could not be resolved: "${path}". ` +
          `There is no "${segment}" under "${walked.join("/") || "(root)"}". ` +
          (available.length > 0
            ? `Fields available there: ${available.join(", ")}`
            : "There are no fields there."),
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
  if (!isNode(parsed)) throw new Error(`The schema is not an object: ${entry.schema}`);
  const root = parsed;

  const { node, walked } = walk(root, options.path ?? "");

  const formatVersions = new Set<string>();
  collectFormatVersions(root, formatVersions, 0);

  const target = isNode(node) ? node : {};
  // `required` alanların durduğu düğümden okunuyor, target'tan değil. Dizi
  // düğümünde zorunluluk items içinde yazılı; target'a bakmak onu düşürürdü.
  const fields = fieldsOf(target, root);
  // Düğümün KENDİ required'ı da sayılıyor: general/manifest.json zorunlu
  // alanlarını kökte, alanları allOf içinde tutuyor. Yalnızca birine bakmak
  // o tipte zorunluları düşürürdü.
  const required = new Set([...requiredOf(target), ...(fields?.required ?? [])]);
  const children = fields?.properties ?? {};

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

  if (fields?.viaItems === true) summary.arrayItems = true;
  if (fields?.branches !== undefined) summary.oneOfBranches = fields.branches;

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
      `Descriptions were dropped for ${total} fields (byte cap). ` +
      "Use path to descend for the detail of a single field.",
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
      `Only the names of ${total} fields are listed (byte cap). ` +
      "All of them are here; use path to descend for detail.",
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
        `${kept} of ${total} fields are listed, the rest were cut (byte cap). ` +
        "Narrow it down: use path to descend into a child node.",
      properties: namesOnly.properties.slice(0, kept),
    };
    if (size(clipped) <= limit) break;
  }
  return clipped;
}
