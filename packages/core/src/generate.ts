/**
 * Üretim döngüsü.
 *
 *   istek → yapılabilirlik → bağlam → prompt → model → normalize → doğrulama
 *        → hata varsa hatayı da vererek TEK retry
 *
 * O tek retry ürünün genel modellerden farkı (docs/ROADMAP.md). Sayısı sabit
 * bir: ikinci bir hata döngüsü kaliteyi artırmıyor, maliyeti artırıyor.
 *
 * `context` ve `review` parametre olarak alınıyor. İkisi de Node'a bağlı
 * (dosya sistemi, ajv, tsc); Aşama 4'te ikisinin de yerine bir HTTP çağrısı
 * geçecek ve bu dosya değişmeyecek (mimari kural 2).
 *
 * Bu yüzden burada node: modülü import edilmiyor — ve `./context.ts` yalnızca
 * TİP olarak import ediliyor. Değer olarak import edilseydi çalışma zamanında
 * @codecraft/knowledge üzerinden node:fs zinciri buraya kadar gelirdi; ölçüldü,
 * kırıktı (packages/core/test/layers.test.ts geçişli grafiği izliyor).
 */
import type { LanguageModel } from "ai";

import type { Context } from "./context.ts";
import { checkFeasibility, type FeasibilityResult } from "./feasibility.ts";
import { callModel } from "./model.ts";
import { normalize, type Fix } from "./normalize.ts";
import type { Generation } from "./output.ts";
import { buildRetryPrompt, buildSystemPrompt } from "./prompt.ts";
import type { Review, ReviewFn } from "./review.ts";
import type { Config } from "./config.ts";

export type Attempt = {
  /** 1 tabanlı. 2 varsa retry koşmuş demektir. */
  number: number;
  generation: Generation;
  fixes: Fix[];
  review: Review;
};

export type GenerateResult =
  | {
      /** Yapılabilirlik katmanı engelledi; model hiç çağrılmadı. */
      status: "infeasible";
      feasibility: Extract<FeasibilityResult, { blocked: true }>;
    }
  | {
      status: "generated";
      context: Context;
      attempts: Attempt[];
      /** Son denemenin çıktısı. */
      files: Generation["files"];
      notes: string | undefined;
      review: Review;
      ok: boolean;
    };

export type GenerateOptions = {
  config: Config;
  /**
   * Sürüme kilitli bağlam ya da onu kuran fonksiyon.
   *
   * Fonksiyon biçimi `model` ile aynı sebepten: yapılabilirlik engellediğinde
   * bağlam da kurulmaz, yani gereksiz bir dosya okuması (Aşama 4'te gereksiz
   * bir HTTP çağrısı) yapılmaz.
   */
  context: Context | (() => Promise<Context>);
  /**
   * Model ya da onu kuran fonksiyon.
   *
   * Fonksiyon biçimi yapılabilirlik kapısı için: engellenen bir istekte model
   * hiç kurulmuyor, dolayısıyla API anahtarı bile gerekmiyor. "Model
   * çağrılmaz" iddiası ancak böyle gerçek oluyor.
   */
  model: LanguageModel | (() => LanguageModel);
  review: ReviewFn;
  /** Test ve eval için: her denemeden sonra çağrılır. */
  onAttempt?: (attempt: Attempt) => void;
};

export async function generate(
  request: string,
  options: GenerateOptions,
): Promise<GenerateResult> {
  // Yapılabilirlik önce koşar: engelliyse model hiç çağrılmaz. Hem token
  // tasarrufu hem en sık hatanın baştan kesilmesi (docs/ROADMAP.md).
  const feasibility = checkFeasibility(request);
  if (feasibility.blocked) return { status: "infeasible", feasibility };

  const model = typeof options.model === "function" ? options.model() : options.model;

  const context =
    typeof options.context === "function" ? await options.context() : options.context;
  const system = buildSystemPrompt(context);

  const attempts: Attempt[] = [];
  let prompt = request;

  // Tam iki tur: ilk deneme + tek retry.
  for (let number = 1; number <= 2; number += 1) {
    const generation = await callModel({
      model,
      config: options.config,
      system,
      prompt,
    });

    // Dosya adı kuralı doğrulamadan ÖNCE düzeltiliyor: bu bir üretim hatası,
    // modele geri sorulacak bir şey değil (docs/VALIDATION-LIMITS.md B).
    const { files, fixes } = normalize(generation.files);
    const fixed: Generation = { ...generation, files };
    const review = await options.review(files, context.version);

    const attempt: Attempt = { number, generation: fixed, fixes, review };
    attempts.push(attempt);
    options.onAttempt?.(attempt);

    if (review.ok || number === 2) {
      return {
        status: "generated",
        context,
        attempts,
        files,
        notes: fixed.notes,
        review,
        ok: review.ok,
      };
    }

    prompt = `${request}\n\n${buildRetryPrompt(review)}`;
  }

  // Döngü her iki dalda da dönüyor; buraya ulaşılamaz.
  throw new Error("üretim döngüsü beklenmedik biçimde sonlandı");
}
