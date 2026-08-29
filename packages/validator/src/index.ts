// @codecraft/validator — Aşama 2 (bkz. TODO.md)
//
// Saf fonksiyonlar, hiçbir model çağrısı yok (CLAUDE.md, mimari kural 3).
//
//   validateJson(içerik, tip, sürüm)   Blockception şemasına karşı, ajv ile
//   validateScript(kod, seçenekler)    tsc sarmalayıcısı
//
// Kimlik araması @codecraft/knowledge içinde (lookup, blockStates).

export { validateJson } from "./json.ts";
export type { JsonError, JsonErrorKind, JsonResult } from "./json.ts";
export { validateScript } from "./script.ts";
export type { ScriptChannel, ScriptDiagnostic, ScriptOptions, ScriptResult } from "./script.ts";
export { listTypes, resolveType } from "./schema-map.ts";
export type { ResolvedType, SchemaMapEntry } from "./schema-map.ts";
