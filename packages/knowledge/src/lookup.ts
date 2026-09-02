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
  // 02-09-2026'da eklendi ve bir YANLIŞ POZİTİFİ kapattı. Öncesinde
  // `/particle minecraft:heart_particle` — tamamen geçerli bir vanilla
  // komutu — checkCommandIdentities'ten "1.26.40.5 sürümünde yok" diye
  // ERROR alıyordu. Ölçülerek görüldü, sonra düzeltildi.
  "particle",
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
  particle: "particles.json",
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
      throw new Error(`blocks.json is inconsistent: state "${name}" of "${normalized}" is undefined`);
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

/** Molang sorgusu / matematik fonksiyonu tanımı — `data/<sürüm>/molang.json`. */
export type MolangEntry = {
  min: number;
  /** Yoksa üst sınır yok (değişken argümanlı). */
  max?: number;
  returns?: string;
  sets?: string[];
  since?: string;
  /** Doluysa bu sürümden sonra kaldırılmış. */
  until?: string;
};

export type MolangIndex = {
  queries: Record<string, MolangEntry>;
  math: Record<string, MolangEntry>;
};

const MOLANG_FILE = "molang.json";

/**
 * Bu sürümde tanımlı Molang sorguları ve matematik fonksiyonları.
 *
 * Anahtarlar önek atılmış ve küçük harfe indirilmiş: `query.Is_Baby` ve
 * `q.is_baby` aynı kayda düşer. Molang büyük/küçük harfe duyarsız
 * (`metadata/doc_modules/molang.json`, "Case Sensitivity").
 *
 * Molang entity bileşenlerinde, animasyon ve render denetleyicilerinde düz
 * string olarak duruyor; ne JSON şeması ne `tsc` içine bakıyor.
 */
export async function molangIndex(options: { version?: string } = {}): Promise<MolangIndex> {
  const { dir } = await resolveVersion(options.version);
  return readIndex<MolangIndex>(dir, MOLANG_FILE);
}


/** Kimlik değil YOL ya da nokta adı taşıyan referans kümeleri. */
export type ReferenceIndex = {
  /** `sound_definitions.json` anahtarları: "ambient.basalt_deltas.mood". */
  sounds: string[];
  /** `music_definitions.json` kök anahtarları: "cherry_grove", "menu". */
  music: string[];
  /** Paket köküne göreli: "loot_tables/entities/cow.json". */
  lootTables: string[];
  /** Paket köküne göreli: "trading/armorer_trades.json". */
  tradeTables: string[];
};

export const REFERENCE_KINDS = ["sounds", "music", "lootTables", "tradeTables"] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

const REFERENCES_FILE = "references.json";

/**
 * Vanilla ses, müzik, loot ve trade tablo referansları.
 *
 * Bunlar `lookup` ile aranamıyor çünkü kimlik değiller: ses olayı nokta ayraçlı
 * bir ad ("mob.cow.say"), loot tablosu ise bir DOSYA YOLU
 * ("loot_tables/entities/cow.json"). `minecraft:loot` ve
 * `minecraft:trade_table` bileşenleri o yola işaret ediyor; şema yolun
 * biçimine bakıyor, işaret ettiği dosyanın var olup olmadığına değil —
 * docs/VALIDATION-LIMITS.md A ile aynı yapı.
 */
export async function referenceSet(
  kind: ReferenceKind,
  options: { version?: string } = {},
): Promise<ReadonlySet<string>> {
  const { dir } = await resolveVersion(options.version);
  const key = `${join(dir, REFERENCES_FILE)}#${kind}`;

  const cached = idCache.get(key);
  if (cached !== undefined) return cached;

  const index = await readIndex<ReferenceIndex>(dir, REFERENCES_FILE);
  const set = new Set(index[kind] ?? []);
  idCache.set(key, set);
  return set;
}


/**
 * Doküman tipi başına geçerli bileşen adları — `data/<sürüm>/components.json`.
 *
 * Kaynak Mojang'ın kendi dokümantasyonu (`metadata/doc_modules/`). Bölümler
 * ayrı tutuluyor çünkü hepsi aynı `minecraft:` önekiyle başlıyor ama anlamları
 * farklı: AI hedefi bileşen değil, olay bileşen değil. Hepsini tek kümeye
 * koymak, olay adını bileşen yerine yazan bir dosyayı geçirirdi.
 */
export type ComponentIndex = {
  blockComponents: string[];
  blockTriggers: string[];
  entityComponents: string[];
  entityGoals: string[];
  entityAttributes: string[];
  entityProperties: string[];
  entityEvents: string[];
  featureTypes: string[];
  biomeComponents: string[];
  clientBiomeComponents: string[];
};

const COMPONENTS_FILE = "components.json";

export async function componentIndex(
  options: { version?: string } = {},
): Promise<ComponentIndex> {
  const { dir } = await resolveVersion(options.version);
  return readIndex<ComponentIndex>(dir, COMPONENTS_FILE);
}

/** Modül sürümü → o sürümdeki `afterEvents` tetiklenme sırası. */
export type EventOrderIndex = Record<string, string[]>;

const EVENT_ORDER_FILE = "event-order.json";

/**
 * `@minecraft/server` sürümü başına afterEvent sırası.
 *
 * D sınıfı (geçerli ama amaçlanmayan) için veri ayağı: hangi olayın var
 * olduğu ve hangi sırada tetiklendiği burada yazılı
 * (docs/VALIDATION-LIMITS.md D).
 */
export async function eventOrder(
  options: { version?: string } = {},
): Promise<EventOrderIndex> {
  const { dir } = await resolveVersion(options.version);
  return readIndex<EventOrderIndex>(dir, EVENT_ORDER_FILE);
}
