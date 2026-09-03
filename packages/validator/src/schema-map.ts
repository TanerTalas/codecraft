/**
 * Doküman tipi -> şema çözümlemesi.
 *
 * Eşleme bizim değil: Blockception'ın vscode-settings.json'ından türetiliyor ve
 * pipeline data/blockception/schema-map.json'a yazıyor
 * (CLAUDE.md, "kendi JSON şemalarını yazma").
 *
 * Kanonik tip adı derlenmiş dosyanın yolu, uzantısız:
 * "behavior/blocks/blocks", "general/manifest".
 */
import { readFile } from "node:fs/promises";
import { join, matchesGlob, posix } from "node:path";

import { resolveVersion } from "@codecraft/knowledge";

export type SchemaMapEntry = {
  type: string;
  /** data/blockception/ köküne göreli. */
  schema: string;
  fileMatch: string[];
};

export type ResolvedType = {
  entry: SchemaMapEntry;
  /** Derlenmiş şema dosyasının mutlak yolu. */
  path: string;
};

type Catalog = {
  version: string;
  root: string;
  entries: SchemaMapEntry[];
  byType: Map<string, SchemaMapEntry>;
  /** Son iki parçası aynı olan tipler için kısaltma: behavior/blocks/blocks -> behavior/blocks */
  byAlias: Map<string, SchemaMapEntry | null>;
};

const catalogs = new Map<string, Catalog>();

/** "behavior/blocks/blocks" -> "behavior/blocks". Tekrar yoksa null. */
function collapse(type: string): string | null {
  const parts = type.split("/");
  const last = parts.at(-1);
  const previous = parts.at(-2);
  return last !== undefined && last === previous ? parts.slice(0, -1).join("/") : null;
}

export async function loadCatalog(version?: string): Promise<Catalog> {
  const { dir, index, version: resolved } = await resolveVersion(version);
  const cached = catalogs.get(resolved);
  if (cached !== undefined) return cached;

  const { compiled } = index.sources.blockception;
  const mapPath = join(dir, compiled.map);
  const entries = JSON.parse(await readFile(mapPath, "utf8")) as SchemaMapEntry[];
  if (entries.length === 0) {
    throw new Error(`${mapPath} is empty — the pipeline did not finish`);
  }

  const byType = new Map(entries.map((entry) => [entry.type, entry]));

  // Kısaltma sadece tek bir tipe götürüyorsa kabul edilir. Belirsizse null
  // yazılır ki çözümleme sessizce yanlış şemayı seçmesin.
  const byAlias = new Map<string, SchemaMapEntry | null>();
  for (const entry of entries) {
    const alias = collapse(entry.type);
    if (alias === null) continue;
    byAlias.set(alias, byAlias.has(alias) ? null : entry);
  }

  const catalog: Catalog = {
    version: resolved,
    root: join(dir, compiled.path),
    entries,
    byType,
    byAlias,
  };
  catalogs.set(resolved, catalog);
  return catalog;
}

/**
 * Paket KÖKÜNDEN yazılmış yollar için sentetik önek.
 *
 * ÖLÇÜLDÜ 03-09-2026, gerçek kullanımda (`docs/mcp-kullanim.md`, ikinci ölçüm
 * kümesi): `review_pack` "spawn_rules/guard.json" yolunu çözemiyordu ama
 * "BP/spawn_rules/guard.json" çözüyordu — aynı içerik, biri şema hatasını
 * buluyor, diğeri bulmuyordu.
 *
 * Sebep Blockception'ın `fileMatch` kalıpları: hepsi klasörden ÖNCE bir paket
 * segmenti istiyor: `*BP*`, `*bp*`, `behavior_packs` ve `*Behavior*Pack*`
 * ile başlayan kalıplar.
 * Kök göreli yol için kalıp yok. Aşağıdaki sonek döngüsü baştan segment
 * ATABİLİYOR ama EKLEYEMİYOR, o yüzden kendi başına yetmiyor.
 *
 * Modelin doğal yazımı kök göreli — `build-test-pack.ts` de paketi diske
 * öyle yazıyor. Yani kaçırılan hâl istisna değil, varsayılan hâl.
 */
const ROOT_PREFIXES = ["BP", "RP"];

/** Girdi bir dosya yoluysa sondan başlayarak her son eki dener (VS Code fileMatch gibi). */
function matchByGlob(catalog: Catalog, input: string): SchemaMapEntry | null {
  const normalized = input.split(/[\/]/).filter((part) => part !== "").join(posix.sep);
  const segments = normalized.split(posix.sep);

  for (let start = 0; start < segments.length; start += 1) {
    const suffix = segments.slice(start).join(posix.sep);
    for (const entry of catalog.entries) {
      if (entry.fileMatch.some((pattern) => matchesGlob(suffix, pattern))) return entry;
    }
  }

  // Kök göreli yol: önek ekleyerek tekrar dene. İkisi de farklı bir tipe
  // uyuyorsa (blocks/, items/ gibi hem BP hem RP'de olan klasörler) tahmin
  // YAPILMAZ — "yakın bir şemaya düşmek yok" kuralı burada da geçerli.
  const matched = new Map<string, SchemaMapEntry>();
  for (const prefix of ROOT_PREFIXES) {
    const prefixed = `${prefix}${posix.sep}${normalized}`;
    for (const entry of catalog.entries) {
      if (entry.fileMatch.some((pattern) => matchesGlob(prefixed, pattern))) {
        matched.set(entry.type, entry);
        break;
      }
    }
  }

  if (matched.size === 1) {
    const [only] = [...matched.values()];
    return only ?? null;
  }
  if (matched.size > 1) {
    throw new Error(
      `Path "${input}" matches more than one document type at the pack root ` +
        `(${[...matched.keys()].join(", ")}). Prefix it with BP/ or RP/, ` +
        "or pass the document type explicitly.",
    );
  }
  return null;
}

/**
 * Tip adını, kısaltmasını veya bir dosya yolunu şemaya çevirir.
 * Çözemezse hata verir — yakın bir şemaya düşmek yok.
 */
export async function resolveType(type: string, version?: string): Promise<ResolvedType> {
  const catalog = await loadCatalog(version);

  const exact = catalog.byType.get(type);
  if (exact !== undefined) return { entry: exact, path: schemaPath(catalog, exact) };

  if (catalog.byAlias.has(type)) {
    const alias = catalog.byAlias.get(type);
    if (alias === null || alias === undefined) {
      throw new Error(`Type "${type}" resolves to more than one schema, give the full name`);
    }
    return { entry: alias, path: schemaPath(catalog, alias) };
  }

  const matched = matchByGlob(catalog, type);
  if (matched !== null) return { entry: matched, path: schemaPath(catalog, matched) };

  throw new Error(
    `Document type could not be resolved: "${type}". ` +
      `data/blockception/schema-map.json lists ${catalog.entries.length} types.`,
  );
}

const schemaPath = (catalog: Catalog, entry: SchemaMapEntry): string =>
  join(catalog.root, entry.schema.split("/").slice(1).join("/"));

/** Bu sürümde doğrulanabilen tüm doküman tipleri. */
export async function listTypes(version?: string): Promise<string[]> {
  return (await loadCatalog(version)).entries.map((entry) => entry.type);
}

/**
 * Doküman tipi -> şemanın kabul ettiği `format_version` değerleri.
 *
 * Var olma sebebi ölçüm: ilk gerçek kapı koşusunda model
 * `"format_version": "1.26.40"` yazdı ve spawn rules şeması reddetti
 * (yalnızca 1.8.0 / 1.10.0 / 1.12.0 kabul ediyor). Sebep prompt'tu —
 * `format_version` OYUN SÜRÜMÜ DEĞİL, o dosya tipinin kendi şema sürümü.
 *
 * Değerler şemadan okunuyor, elle yazılmıyor: sürüm değişince kendiliğinden
 * güncellenir. Şemaların çoğu bu alanı kısıtlamıyor; kısıtlayanlar döner.
 */
export async function schemaFormatVersions(
  version?: string,
): Promise<Record<string, string[]>> {
  const catalog = await loadCatalog(version);
  const out: Record<string, string[]> = {};

  for (const entry of catalog.entries) {
    let schema: unknown;
    try {
      schema = JSON.parse(await readFile(schemaPath(catalog, entry), "utf8"));
    } catch {
      continue; // eksik şema schema-map'te zaten "missing" olarak kayıtlı
    }

    const found = new Set<string>();
    collectFormatVersions(schema, found, 0);
    if (found.size > 0) out[entry.type] = [...found].sort();
  }

  return out;
}

/**
 * Şema ağacında `properties.format_version` arar.
 *
 * Düz aramak yetmiyor: değerler çoğu zaman `oneOf` dalları içinde duruyor,
 * o yüzden ağaç geziliyor. Derinlik sınırlı — döngüsel şemada asılı kalmasın.
 */
function collectFormatVersions(node: unknown, out: Set<string>, depth: number): void {
  if (depth > 30 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) collectFormatVersions(child, out, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;
  const properties = record["properties"];
  if (properties !== null && typeof properties === "object") {
    const field = (properties as Record<string, unknown>)["format_version"];
    if (field !== null && typeof field === "object") {
      const spec = field as Record<string, unknown>;
      if (Array.isArray(spec["enum"])) for (const value of spec["enum"]) out.add(String(value));
      if (spec["const"] !== undefined) out.add(String(spec["const"]));
    }
  }

  for (const child of Object.values(record)) collectFormatVersions(child, out, depth + 1);
}
