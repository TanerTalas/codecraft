// @codecraft/validator — doğrulama katmanı. LLM çağrısı yok.
//
// Saf fonksiyonlar, hiçbir model çağrısı yok (CLAUDE.md, mimari kural 3).
//
//   validateJson(içerik, tip, sürüm)   Blockception şemasına karşı, ajv ile
//   validateScript(kod, seçenekler)    tsc sarmalayıcısı
//
// Kimlik araması @codecraft/knowledge içinde (lookup, blockStates).

export { validateJson } from "./json.ts";
export type { JsonError, JsonErrorKind, JsonResult } from "./json.ts";
export { scriptRuntimeReport, validateScript } from "./script.ts";
export type {
  RuntimeCheck,
  RuntimeReport,
  ScriptChannel,
  ScriptDiagnostic,
  ScriptOptions,
  ScriptResult,
} from "./script.ts";
export { pythonRuntimeReport, resetPythonCache, validatePython } from "./python.ts";
export type {
  PythonFinding,
  PythonOptions,
  PythonResult,
  PythonRuntimeCheck,
} from "./python.ts";
export { listTypes, resolveType, schemaFormatVersions } from "./schema-map.ts";
export {
  CHECKED_TYPES,
  loadCommandIndex,
  parseBlockStates,
  SELECTOR_LETTERS,
  tokenize,
  validateCommand,
} from "./command.ts";
export type {
  CommandDef,
  CommandError,
  CommandErrorKind,
  CommandIndex,
  CommandOptions,
  CommandOverload,
  CommandParam,
  CommandResult,
} from "./command.ts";
export type { ResolvedType, SchemaMapEntry } from "./schema-map.ts";

// Asama M3 — MCP get_schema araci icin sema ozeti. Ham sema dondurulemez:
// entities.json 585.237 bayt. Olcum ve kademeli daralma schema-summary.ts'te.
export { summarizeSchema } from "./schema-summary.ts";
export type { Detail, SchemaProperty, SchemaSummary, SummaryOptions } from "./schema-summary.ts";

// Asama 2.5 — semanin ve tsc'nin yapisal olarak yakalayamadigi kontroller.
// Olcum ve gerekce: docs/VALIDATION-LIMITS.md
export {
  checkAssets,
  checkCommandIdentities,
  checkFileNames,
  checkManifest,
  checkIdentities,
  checkMolang,
  checkPatterns,
  checkReferences,
  checkSounds,
  patternGuide,
  patternNames,
} from "./checks.ts";
export type {
  AssetOptions,
  CheckResult,
  CommandIdentityOptions,
  Finding,
  IdentityOptions,
  MolangCheckOptions,
  PackFile,
  ReferenceOptions,
  PatternGuide,
  PatternOptions,
} from "./checks.ts";

// Molang: sema stringin ICINE bakmiyor, tsc de gormuyor.
// Gerekce ve olcum: packages/validator/src/molang.ts basligi.
export { scanMolang, validateMolang } from "./molang.ts";
export type {
  MolangCall,
  MolangFinding,
  MolangOptions,
  MolangResult,
} from "./molang.ts";
