// @codecraft/core/server — sunucuda koşan yüzey (Aşama M2)
//
// browser.ts'in sunucu tarafındaki eşi. Orada soru "tarayıcıya ne girmemeli"
// idi; burada soru "MCP sunucusuna ne girmemeli".
//
// Mimari kural 2: CodeCraft modeli kendi çalıştırmaz, kullanıcının anahtarını
// görmez. MCP'de modeli kullanıcı getiriyor — sunucunun bir LLM SDK'sına
// ihtiyacı YOK. Ama core barrel'ı (index.ts) model.ts'i de dışa açıyor ve o
// `ai` + `@ai-sdk/google`'ı çekiyor. `packages/mcp` barrel'dan import ederse
// LLM SDK'sı sessizce sunucu paketine girer.
//
// Bu dosya o dikişi atıyor: buradan ulaşılabilen hiçbir modül `ai` ya da
// `@ai-sdk/*` import etmez.
//
// Kural laf olarak değil ölçüyle duruyor: `packages/core/test/layers.test.ts`
// bu dosyadan başlayıp import grafiğini GEÇİŞLİ olarak yürüyor, ve
// `packages/mcp/test/layers.test.ts` mcp'nin barrel'a hiç dokunmadığını
// ayrıca ölçüyor.
//
// DIŞARIDA BIRAKILANLAR ve gerekçeleri:
//   model.ts, generate.ts  — `ai` + `@ai-sdk/google`. Sızıntının kaynağı.
//   config.ts              — API anahtarı okur (mimari kural 2).
//   pack.ts, cli.ts        — diske yazar; MCP araçlarının hepsi salt okunur.
//   api.ts                 — remoteReview/fetchConfig tarayıcının HTTP
//                            istemcisi; sunucuda fonksiyonun kendisi çağrılır.

export { UserError } from "./errors.ts";

export { buildContext } from "./context.ts";
export type { Context, ContextOptions, IdentityNote } from "./context.ts";

export { ABSENT_APIS, checkFeasibility, feasibilityRules } from "./feasibility.ts";
export type { Category, FeasibilityResult, FeasibilityRule } from "./feasibility.ts";

export { normalize } from "./normalize.ts";
export type { Fix, NormalizeResult } from "./normalize.ts";

// review_pack'in girdi şeması buradan geliyor (Aşama M3). Saf zod, `ai` çekmez.
export { generatedFileSchema, generationSchema, LAYOUT } from "./output.ts";
export type { GeneratedFile, Generation } from "./output.ts";

export {
  buildReport,
  isScript,
  review,
  SCRIPT_EXTENSIONS,
  validateFile,
  validateFiles,
} from "./review.ts";
export type { FileResult, Review, ReviewFn } from "./review.ts";
