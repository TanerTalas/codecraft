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

import { requireApiKey, type Config } from "./config.ts";
import { UserError } from "./errors.ts";
import { generationSchema, type Generation } from "./output.ts";

/** Sağlayıcı ve anahtar limitinden kaynaklanan başarısızlık. */
export class RateLimitError extends UserError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RateLimitError";
  }
}

/** Hata zincirinde 429 var mı. SDK denemeleri tükettiğinde sarmalayarak fırlatıyor. */
export function isRateLimit(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current != null && depth < 8; depth += 1) {
    if (APICallError.isInstance(current) && current.statusCode === 429) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Sağlayıcı istemcisini kurar.
 *
 * `env` parametre: tarayıcıda process yok, o yüzden Aşama 4 anahtarı doğrudan
 * geçecek — varsayılan değer yalnızca argüman verilmediğinde değerlendirilir.
 */
export function createModel(config: Config, env = process.env): LanguageModel {
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

/** Tek model çağrısı. Sözleşmeye uymayan çıktı istisna olarak döner. */
export async function callModel(options: GenerateOptions): Promise<Generation> {
  const { model, config, system, prompt } = options;

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
    if (isRateLimit(error)) {
      throw new RateLimitError(
        "Sağlayıcı istek limiti aşıldı (429) ve yeniden denemeler tükendi. " +
          "Bu bir model başarısızlığı değil — bekleyip tekrar dene ya da " +
          "codecraft.config.json içindeki requestDelayMs değerini artır.",
        { cause: error },
      );
    }
    throw error;
  }
}

/** Sağlayıcının bu anahtar için sunduğu modeller. Tahmin edilmez, sorulur. */
export async function listModels(config: Config, env = process.env): Promise<string[]> {
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
