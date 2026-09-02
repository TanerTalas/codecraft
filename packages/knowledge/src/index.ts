// @codecraft/knowledge — data/ üzerindeki lookup katmanı.
//
// data/<sürüm>/ altındaki üretilmiş indeksler üzerinde lookup katmanı.
// Vektör DB veya embedding yok — veri yapılandırılmış ve küçük
// (CLAUDE.md, "Yapılmayacaklar").

export { DATA_DIR, MARKERS, ROOT } from "./paths.ts";
export { comMojangCandidates, findDevPacksDir } from "./game-paths.ts";
export { listDataVersions, resolveVersion } from "./version.ts";
export type { DataIndex, DataVersion } from "./version.ts";
export {
  ALL_KINDS,
  KINDS,
  TEXTURE_ATLASES,
  blockStates,
  lookup,
  lookupAny,
  normalizeId,
  textureKeys,
} from "./lookup.ts";
export type {
  AnyKind,
  AnyLookupResult,
  BlockProperty,
  BlockStates,
  Kind,
  LookupOptions,
  LookupResult,
  TextureAtlas,
} from "./lookup.ts";
