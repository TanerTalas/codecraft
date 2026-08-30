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

/**
 * Kimlik taşıyan bütün indeksler.
 *
 * KINDS üçü doğrulamanın asıl kullandığı küme. Komut metinlerinde ise
 * minecraft: namespace'i bunların dışına da çıkıyor (efekt, boyut, büyü,
 * biyom...) ve o kimliklere "yok" demek uydurma hata üretirdi — bu yüzden
 * geniş arama ayrı bir fonksiyon.
 */
export const ALL_KINDS = [
  "block",
  "item",
  "entity",
  "biome",
  "camera-preset",
  "cooldown-category",
  "dimension",
  "effect",
  "enchantment",
  "feature",
  "potion-effect",
  "potion-type",
] as const;
export type AnyKind = (typeof ALL_KINDS)[number];

/** Her tür kendi indeks dosyasından okunur. */
const INDEX_FILE: Record<AnyKind, string> = {
  block: "blocks.json",
  item: "items.json",
  entity: "entities.json",
  biome: "biomes.json",
  "camera-preset": "camera-presets.json",
  "cooldown-category": "cooldown-category.json",
  dimension: "dimensions.json",
  effect: "effects.json",
  enchantment: "enchantments.json",
  feature: "features.json",
  "potion-effect": "potion-effects.json",
  "potion-type": "potion-types.json",
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

export type AnyLookupResult = {
  id: string;
  found: boolean;
  /** Hangi indekste bulundu. Bulunamadıysa null. */
  kind: AnyKind | null;
  version: string;
};

/**
 * Kimliği BÜTÜN indekslerde arar.
 *
 * lookup() blok/item/entity'ye bakar — doğrulamanın ihtiyacı o. Komut
 * metinlerinde ise minecraft:speed (efekt) veya minecraft:overworld (boyut)
 * gibi kimlikler de geçiyor; dar arama onlara "yok" derdi ve uydurma hata
 * üretmek, kaçırmaktan kötü.
 */
export async function lookupAny(
  id: string,
  options: { version?: string } = {},
): Promise<AnyLookupResult> {
  const { dir, version } = await resolveVersion(options.version);
  const normalized = normalizeId(id);

  for (const kind of ALL_KINDS) {
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

/** Doku atlası: item ikonları ile blok yüzeyleri ayrı atlaslarda tutulur. */
export const TEXTURE_ATLASES = ["item", "terrain"] as const;
export type TextureAtlas = (typeof TEXTURE_ATLASES)[number];

const TEXTURES_FILE = "textures.json";

type TextureIndex = Record<TextureAtlas, string[]>;

/**
 * Bu sürümde tanımlı vanilla doku anahtarları.
 *
 * `minecraft:icon` ve `material_instances[].texture` bir kaynak paketindeki
 * anahtara işaret ediyor. v1 kaynak paketi üretmiyor (CLAUDE.md), o yüzden
 * yalnızca vanilla'da zaten var olan bir anahtar kullanılabilir — yoksa oyun
 * `Missing referenced asset` diye içerik hatası basıyor
 * (docs/VALIDATION-LIMITS.md C).
 */
export async function textureKeys(
  atlas: TextureAtlas,
  options: { version?: string } = {},
): Promise<ReadonlySet<string>> {
  const { dir } = await resolveVersion(options.version);
  const path = join(dir, TEXTURES_FILE);

  const cached = idCache.get(`${path}#${atlas}`);
  if (cached !== undefined) return cached;

  const index = await readIndex<TextureIndex>(dir, TEXTURES_FILE);
  const keys = new Set(index[atlas] ?? []);
  idCache.set(`${path}#${atlas}`, keys);
  return keys;
}
