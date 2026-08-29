/**
 * data/<sürüm>/ indeksleri üzerinde kimlik araması.
 *
 * Vektör DB veya embedding yok — veri yapılandırılmış ve küçük
 * (CLAUDE.md, "Yapılmayacaklar"). Sürüm ve niyet belliyse hangi JSON'a
 * bakılacağı da belli.
 *
 * Var olma sebebi: modeller uydurulmuş blok kimliği üretiyor
 * (minecraft:ruby_block gibi) ve şema doğrulaması bunu yakalamıyor — şema
 * kimliğin biçimine bakar, gerçekten var olup olmadığına değil.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveVersion } from "./version.ts";

export const KINDS = ["block", "item", "entity"] as const;
export type Kind = (typeof KINDS)[number];

/** Her tür kendi indeks dosyasından okunur. */
const INDEX_FILE: Record<Kind, string> = {
  block: "blocks.json",
  item: "items.json",
  entity: "entities.json",
};

/** Blok durumu tanımı: blocks.json'ın properties alanından. */
export type BlockProperty = {
  type: "bool" | "int" | "string";
  values: (boolean | number | string)[];
};

type IdIndex = { ids: string[] };
type BlockIndex = IdIndex & {
  properties: Record<string, BlockProperty>;
  states: Record<string, string[]>;
};

const cache = new Map<string, unknown>();
/** Kimlik kümeleri ayrı tutulur: arama dizide gezinmesin. */
const idCache = new Map<string, ReadonlySet<string>>();

async function readIndex<T>(dir: string, file: string): Promise<T> {
  const path = join(dir, file);
  const cached = cache.get(path);
  if (cached !== undefined) return cached as T;
  const parsed = JSON.parse(await readFile(path, "utf8")) as T;
  cache.set(path, parsed);
  return parsed;
}

async function readIds(dir: string, file: string): Promise<ReadonlySet<string>> {
  const path = join(dir, file);
  const cached = idCache.get(path);
  if (cached !== undefined) return cached;
  const ids = new Set((await readIndex<IdIndex>(dir, file)).ids);
  idCache.set(path, ids);
  return ids;
}

/** Namespace'siz kimlik minecraft: ile denenir — "stone" -> "minecraft:stone". */
export const normalizeId = (id: string): string =>
  id.includes(":") ? id : `minecraft:${id}`;

export type LookupOptions = {
  version?: string;
  /** Verilmezse üç indekste de aranır. */
  kind?: Kind;
};

export type LookupResult = {
  /** Aranan kimliğin namespace eklenmiş hâli. */
  id: string;
  found: boolean;
  /** Hangi indekste bulundu. Bulunamadıysa null. */
  kind: Kind | null;
  version: string;
};

/** Kimlik bu sürümde gerçekten var mı. */
export async function lookup(id: string, options: LookupOptions = {}): Promise<LookupResult> {
  const { dir, version } = await resolveVersion(options.version);
  const normalized = normalizeId(id);
  const kinds = options.kind === undefined ? KINDS : [options.kind];

  for (const kind of kinds) {
    if ((await readIds(dir, INDEX_FILE[kind])).has(normalized)) {
      return { id: normalized, found: true, kind, version };
    }
  }

  return { id: normalized, found: false, kind: null, version };
}

export type BlockStates = Record<string, BlockProperty>;

/**
 * Bir bloğun durumları ve alabildikleri değerler.
 * Blok yoksa null döner — "durumu yok" ile "blok yok" karışmasın.
 */
export async function blockStates(
  id: string,
  version?: string,
): Promise<BlockStates | null> {
  const { dir } = await resolveVersion(version);
  const index = await readIndex<BlockIndex>(dir, INDEX_FILE.block);
  const normalized = normalizeId(id);

  const names = index.states[normalized];
  if (names === undefined) return null;

  const states: BlockStates = {};
  for (const name of names) {
    const property = index.properties[name];
    if (property === undefined) {
      throw new Error(`blocks.json tutarsız: "${normalized}" durumu "${name}" tanımsız`);
    }
    states[name] = property;
  }
  return states;
}
