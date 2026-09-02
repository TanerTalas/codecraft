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
  REFERENCE_KINDS,
  TEXTURE_ATLASES,
  blockStates,
  lookup,
  lookupAny,
  molangIndex,
  normalizeId,
  referenceSet,
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
  MolangEntry,
  MolangIndex,
  ReferenceIndex,
  ReferenceKind,
  TextureAtlas,
} from "./lookup.ts";
