// @codecraft/core — Aşama 3 (bkz. TODO.md)
//
// Üretim döngüsü burada yaşar: istek → veri toplama → sürüme kilitli prompt →
// model → validator → hatayla birlikte tek retry.
//
// CLI ve web arayüzü bu paketin ince kabuklarıdır (CLAUDE.md, mimari kural 1).
// Mantığı arayüz koduna taşıma.

export { API_KEY_ENV, CONFIG_FILE, LOCAL_CONFIG_FILE, loadConfig, requireApiKey } from "./config.ts";
export type { Config, ProviderName } from "./config.ts";

export { UserError } from "./errors.ts";

export { buildContext } from "./context.ts";
export type { Context, ContextOptions, IdentityNote } from "./context.ts";

export { ABSENT_APIS, checkFeasibility, feasibilityRules } from "./feasibility.ts";
export type { Category, FeasibilityResult, FeasibilityRule } from "./feasibility.ts";

export { generate } from "./generate.ts";
export type { Attempt, GenerateOptions, GenerateResult } from "./generate.ts";

export { callModel, createModel, isRateLimit, listModels, RateLimitError } from "./model.ts";

export { normalize } from "./normalize.ts";
export type { Fix, NormalizeResult } from "./normalize.ts";

export { generatedFileSchema, generationSchema, LAYOUT } from "./output.ts";
export type { GeneratedFile, Generation } from "./output.ts";

export { installPack, writePack } from "./pack.ts";

export { buildRetryPrompt, buildSystemPrompt } from "./prompt.ts";

export {
  buildReport,
  isScript,
  review,
  SCRIPT_EXTENSIONS,
  validateFile,
  validateFiles,
} from "./review.ts";
export type { FileResult, Review, ReviewFn } from "./review.ts";
