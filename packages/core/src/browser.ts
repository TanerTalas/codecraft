// @codecraft/core/browser — tarayıcıda koşan yüzey (Aşama 4)
//
// Mimari kural 2: üretim tarayıcıda, doğrulama sunucuda. Bu dosya o ayrımın
// tek giriş noktası — buradan ulaşılabilen hiçbir modül `node:` bir şey ya da
// bir doğrulama paketi (ajv, tsc) import etmez.
//
// Kural laf olarak değil ölçüyle duruyor: `packages/core/test/layers.test.ts`
// bu dosyadan başlayıp import grafiğini GEÇİŞLİ olarak yürüyor. Buraya
// Node'a bağlı bir modül sızarsa test kırmızıya döner.
//
// Node tarafı (buildContext, review, writePack, loadConfig) `index.ts`'te
// duruyor ve oradan kullanılır.

export { UserError } from "./errors.ts";

export { ABSENT_APIS, checkFeasibility, feasibilityRules } from "./feasibility.ts";
export type { Category, FeasibilityResult, FeasibilityRule } from "./feasibility.ts";

export { generate } from "./generate.ts";
export type { Attempt, GenerateOptions, GenerateResult } from "./generate.ts";

export { callModel, createModel, isCapacityError, listModels, CapacityError } from "./model.ts";

export { normalize } from "./normalize.ts";
export type { Fix, NormalizeResult } from "./normalize.ts";

export { generatedFileSchema, generationSchema, LAYOUT } from "./output.ts";
export type { GeneratedFile, Generation } from "./output.ts";

export { buildRetryPrompt, buildSystemPrompt } from "./prompt.ts";

// Tipler: çalışma zamanında karşılığı yok, tarayıcıya hiçbir kod taşımıyorlar.
// Sunucudan gelen JSON'un şekli bunlarla tarif ediliyor.
export { defaultEnv } from "./provider.ts";
export type { Config, Env, ProviderName } from "./provider.ts";
export type { Context, IdentityNote } from "./context.ts";
export type { FileResult, Review, ReviewFn } from "./review.ts";
