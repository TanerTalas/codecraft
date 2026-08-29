// @codecraft/knowledge — Aşama 2 (bkz. TODO.md)
//
// data/<sürüm>/ altındaki üretilmiş indeksler üzerinde lookup katmanı.
// Vektör DB veya embedding yok — veri yapılandırılmış ve küçük
// (CLAUDE.md, "Yapılmayacaklar").

export { DATA_DIR, ROOT } from "./paths.ts";
export { listDataVersions, resolveVersion } from "./version.ts";
export type { DataIndex, DataVersion } from "./version.ts";
export { KINDS, blockStates, lookup, normalizeId } from "./lookup.ts";
export type { BlockProperty, BlockStates, Kind, LookupOptions, LookupResult } from "./lookup.ts";
