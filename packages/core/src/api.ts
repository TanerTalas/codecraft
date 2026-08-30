/**
 * Tarayıcı ile sunucu arasındaki kablo sözleşmesi.
 *
 * Mimari kural 2 iki şeyi sunucuya bırakıyor: bağlam kurmak (data/ okuyor) ve
 * doğrulama (ajv + tsc). Bu dosya o iki çağrının **hem** gövde şemasını **hem**
 * tarayıcı tarafındaki istemcisini tutuyor.
 *
 * Neden tek dosyada: şema uçta, istemci arayüz kodunda dursaydı ikisi sessizce
 * ayrışırdı. Uç noktalar buradaki şemayı parse ediyor, tarayıcı buradaki
 * istemciyi çağırıyor; sözleşme tek yerde.
 *
 * Saf: node: bir şey yok, doğrulama paketi yok. `fetch` her iki ortamda da var.
 */
import { z } from "zod";

import { UserError } from "./errors.ts";
import { generatedFileSchema } from "./output.ts";
import type { Context } from "./context.ts";
import type { Review, ReviewFn } from "./review.ts";

/** POST /api/context gövdesi. */
export const contextRequestSchema = z.object({
  request: z.string().min(1),
  /** data/ içindeki sürüm. Verilmezse sunucu en yenisini seçer. */
  version: z.string().min(1).optional(),
});

/** POST /api/review gövdesi. `files` üretimin çıktısı, `version` bağlamdan gelir. */
export const reviewRequestSchema = z.object({
  files: z.array(generatedFileSchema).min(1),
  version: z.string().min(1),
});

export type ContextRequest = z.infer<typeof contextRequestSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/** GET /api/config yanıtı. Anahtar İÇERMEZ — sunucu anahtarı hiç görmüyor. */
export type ConfigResponse = {
  provider: string;
  model: string;
  /** data/ altındaki sürümler, yenisi sonda. Sürüm seçici bunu gösterir. */
  versions: string[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Uç nokta hatayı metin olarak veriyor; yutup genel bir mesaj basmak
    // kullanıcıyı sebepsiz bırakırdı.
    const detail = await response.text().catch(() => "");
    throw new UserError(
      `${url}: HTTP ${response.status}${detail === "" ? "" : ` — ${detail}`}`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Sunucudan bağlam isteyen istemci.
 *
 * `generate()`'in `context` parametresine doğrudan verilebilir; imza aynı.
 */
export const remoteContext =
  (request: string, version?: string, baseUrl = "") =>
  (): Promise<Context> =>
    postJson<Context>(`${baseUrl}/api/context`, { request, version });

/**
 * Sunucuda koşan doğrulama.
 *
 * `ReviewFn` imzasının aynısı — `generate()` aradaki farkı görmüyor, tam da
 * bu yüzden üretim döngüsü Aşama 4'te değişmedi.
 */
export const remoteReview =
  (baseUrl = ""): ReviewFn =>
  (files, version) =>
    postJson<Review>(`${baseUrl}/api/review`, { files, version });

/** Sunucudan yapılandırma ve sürüm listesi. */
export async function fetchConfig(baseUrl = ""): Promise<ConfigResponse> {
  const response = await fetch(`${baseUrl}/api/config`);
  if (!response.ok) {
    throw new UserError(`/api/config: HTTP ${response.status}`);
  }
  return (await response.json()) as ConfigResponse;
}
