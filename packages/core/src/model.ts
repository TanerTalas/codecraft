/**
 * Model çağrısı. AI SDK üzerinden, sağlayıcı yapılandırmadan gelir
 * (CLAUDE.md: LLM soyutlaması Vercel AI SDK, model ID'si koda gömülmez).
 *
 * Node'a bağlı değil: Aşama 4'te aynı kod tarayıcıda, kullanıcının kendi
 * anahtarıyla koşacak (mimari kural 2).
 *
 * ai@7'de generateObject "deprecated" — doğru yol generateText + Output.object.
 * Bu, paketin kurulu .d.ts'inden okundu, hatırlanmadı.
 *
 * Yeniden deneme SDK'ya bırakılıyor: maxRetries verildiğinde üstel geri
 * çekilmeyi ve 429'un Retry-After başlığını kendisi uyguluyor. İkinci bir
 * backoff yazmak aynı işi iki kez yapmak olurdu.
 */
import { createGoogle } from "@ai-sdk/google";
import { APICallError, generateText, Output, type LanguageModel } from "ai";

import { defaultEnv, requireApiKey, type Config, type Env } from "./provider.ts";
import { UserError } from "./errors.ts";
import { generationSchema, type Generation } from "./output.ts";

/**
 * Çağrının hiç yapılamamasından doğan başarısızlık — kota ya da kapasite.
 *
 * Model kalitesiyle ilgisi yok ve bu ayrım ölçüm için kritik: bunu "model
 * yanlış çıktı üretti" diye saymak kapı skorunu yalanlar.
 */
export class CapacityError extends UserError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CapacityError";
  }
}

/**
 * Sağlayıcının kapasite/kota durumları. İkisi de ölçülerek eklendi
 * (30-08-2026, Gemini ücretsiz kademe):
 *
 *   429  "You exceeded your current quota"  — pro modellerde ücretsiz kota yok
 *   503  "This model is currently experiencing high demand" — gemini-3.7-flash
 *
 * 503 başta listede yoktu ve ilk gerçek koşuda vakayı "model düştü" diye
 * raporladı. Tahminle değil, o koşuyla eklendi.
 */
const CAPACITY_STATUS = new Set([429, 503]);

/**
 * Hata ağacında kapasite/kota durumu var mı.
 *
 * `cause` zinciri tek başına yetmiyor: SDK denemeleri tükettiğinde `RetryError`
 * fırlatıyor ve o hata asıl sebebi `cause` ile değil `lastError` / `errors`
 * alanlarıyla taşıyor. Bunu ilk gerçek kapı koşusu gösterdi — kota hatası
 * "model düştü" diye raporlanmıştı. Bu yüzden düz bir zincir değil, sınırlı
 * derinlikte bir ağaç geziliyor.
 */
export function isCapacityError(error: unknown): boolean {
  const queue: unknown[] = [error];

  for (let i = 0; i < queue.length && i < 32; i += 1) {
    const current = queue[i];
    if (current == null) continue;

    if (APICallError.isInstance(current) && CAPACITY_STATUS.has(current.statusCode ?? 0)) {
      return true;
    }

    const node = current as { cause?: unknown; lastError?: unknown; errors?: unknown };
    queue.push(node.cause, node.lastError);
    if (Array.isArray(node.errors)) queue.push(...node.errors);
  }

  return false;
}

/**
 * Sağlayıcı istemcisini kurar.
 *
 * `env` parametre: tarayıcıda process yok, o yüzden Aşama 4 anahtarı doğrudan
 * geçecek — varsayılan değer yalnızca argüman verilmediğinde değerlendirilir.
 */
export function createModel(config: Config, env: Env = defaultEnv()): LanguageModel {
  if (config.provider === "google") {
    return createGoogle({ apiKey: requireApiKey("google", env) })(config.model);
  }
  // config.ts sağlayıcıyı zaten doğruluyor; buraya düşmek kod ile
  // yapılandırmanın ayrıştığı anlamına gelir, sessizce geçilmez.
  throw new Error(`Sağlayıcı "${config.provider}" için model kurucusu yok`);
}

export type GenerateOptions = {
  model: LanguageModel;
  config: Config;
  system: string;
  prompt: string;
};

/**
 * Son isteğin zamanı. Modül düzeyinde: sınır sağlayıcı hesabına ait, o hesapla
 * kaç ayrı çağıran olduğuna değil.
 */
let lastRequestAt = 0;

/**
 * İki istek arasında en az `minIntervalMs` geçmesini bekler.
 *
 * VAKA başına değil İSTEK başına: sağlayıcının sınırı da öyle. İlk kapı
 * koşusunda bekleme vaka başınaydı ve retry yapan bir vaka iki isteği arka
 * arkaya atıp kotayı deldi (ölçüldü: dakikada 20 istek).
 *
 * SDK'nın geri çekilmesi limite GİRDİKTEN sonra devreye giriyor; bu ise hiç
 * girmemek için.
 */
async function pace(minIntervalMs: number): Promise<void> {
  if (minIntervalMs <= 0) return;
  const wait = lastRequestAt + minIntervalMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/** Tek model çağrısı. Sözleşmeye uymayan çıktı istisna olarak döner. */
export async function callModel(options: GenerateOptions): Promise<Generation> {
  const { model, config, system, prompt } = options;
  await pace(config.requestDelayMs);

  try {
    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
      maxRetries: config.maxRetries,
      output: Output.object({
        schema: generationSchema,
        name: "bedrock_output",
        description: "Üretilen paket dosyaları ve kullanıcıya not",
      }),
    });
    return result.output;
  } catch (error) {
    if (isCapacityError(error)) {
      throw new CapacityError(
        "Sağlayıcı çağrıyı kabul etmedi (kota 429 veya kapasite 503) ve " +
          "yeniden denemeler tükendi. Model çıktısı değerlendirilemedi. " +
          "Bu bir model başarısızlığı değil — bekleyip tekrar dene ya da " +
          "codecraft.config.json içindeki requestDelayMs değerini artır.",
        { cause: error },
      );
    }
    throw error;
  }
}

/** Sağlayıcının bu anahtar için sunduğu modeller. Tahmin edilmez, sorulur. */
export async function listModels(config: Config, env: Env = defaultEnv()): Promise<string[]> {
  if (config.provider !== "google") {
    throw new Error(`Sağlayıcı "${config.provider}" için model listesi desteklenmiyor`);
  }

  const key = requireApiKey("google", env);
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    { headers: { "x-goog-api-key": key } },
  );
  if (!response.ok) {
    throw new UserError(
      `Model listesi alınamadı: HTTP ${response.status}. Anahtar geçerli mi?`,
    );
  }

  const body = (await response.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };

  return (body.models ?? [])
    .filter((entry) => entry.supportedGenerationMethods?.includes("generateContent") === true)
    .flatMap((entry) => (entry.name === undefined ? [] : [entry.name.replace(/^models\//, "")]))
    .sort();
}
