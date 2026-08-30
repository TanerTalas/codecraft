// @codecraft/knowledge — Aşama 2 (bkz. TODO.md)
//
// data/<sürüm>/ altındaki üretilmiş indeksler üzerinde lookup katmanı.
// Vektör DB veya embedding yok — veri yapılandırılmış ve küçük
// (CLAUDE.md, "Yapılmayacaklar").

export { DATA_DIR, ROOT } from "./paths.ts";
export { comMojangCandidates, findDevPacksDir } from "./game-paths.ts";
export { listDataVersions, resolveVersion } from "./version.ts";
export type { DataIndex, DataVersion } from "./version.ts";
export { ALL_KINDS, KINDS, blockStates, lookup, lookupAny, normalizeId } from "./lookup.ts";
export type {
  AnyKind,
  AnyLookupResult,
  BlockProperty,
  BlockStates,
  Kind,
  LookupOptions,
  LookupResult,
} from "./lookup.ts";
