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
    throw new Error(`${mapPath} boş — pipeline yarım kalmış`);
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
      throw new Error(`Tip "${type}" birden fazla şemaya götürüyor, tam adı verin`);
    }
    return { entry: alias, path: schemaPath(catalog, alias) };
  }

  const matched = matchByGlob(catalog, type);
  if (matched !== null) return { entry: matched, path: schemaPath(catalog, matched) };

  throw new Error(
    `Doküman tipi çözümlenemedi: "${type}". ` +
      `data/blockception/schema-map.json içinde ${catalog.entries.length} tip var.`,
  );
}

const schemaPath = (catalog: Catalog, entry: SchemaMapEntry): string =>
  join(catalog.root, entry.schema.split("/").slice(1).join("/"));

/** Bu sürümde doğrulanabilen tüm doküman tipleri. */
export async function listTypes(version?: string): Promise<string[]> {
  return (await loadCatalog(version)).entries.map((entry) => entry.type);
}
