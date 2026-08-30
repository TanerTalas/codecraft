/**
 * İstek limiti sınıflandırması.
 *
 * Ücretsiz kademede 429 olağan bir durum. "Model yanlış çıktı üretti" ile
 * "çağrı hiç yapılamadı" karışırsa eval skoru model başarımı sanılır ve
 * ölçüm yalan söyler — bu yüzden ayrı bir hata türü var.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import type { Config } from "../src/config.ts";
import { callModel, isCapacityError, CapacityError } from "../src/model.ts";
import { textResponse } from "./helpers.ts";

const CONFIG: Config = {
  provider: "google",
  model: "sahte-model",
  maxOutputTokens: 1024,
  temperature: 0,
  maxRetries: 0,
  requestDelayMs: 0,
};

const apiError = (statusCode: number): APICallError =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.invalid",
    requestBodyValues: {},
    statusCode,
  });

test("429 ve 503 kapasite hatası olarak tanınır", () => {
  assert.equal(isCapacityError(apiError(429)), true);
  // SDK denemeleri tükettiğinde hatayı sarmalayarak fırlatıyor.
  assert.equal(isCapacityError(new Error("tükendi", { cause: apiError(429) })), true);
  // 503 ilk gerçek koşuda çıktı: gemini-3.7-flash "high demand" döndürdü.
  assert.equal(isCapacityError(apiError(503)), true);
});

test("diğer hatalar limit sayılmaz", () => {
  assert.equal(isCapacityError(apiError(400)), false);
  assert.equal(isCapacityError(apiError(500)), false);
  assert.equal(isCapacityError(apiError(400)), false);
  assert.equal(isCapacityError(new Error("düz hata")), false);
});

test("limit hatası CapacityError'a çevrilir ve ne yapılacağını söyler", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw apiError(429);
    },
  });

  await assert.rejects(
    callModel({ model, config: CONFIG, system: "s", prompt: "p" }),
    (error: Error) => {
      assert.ok(error instanceof CapacityError);
      assert.match(error.message, /429/);
      assert.match(error.message, /503/);
      assert.match(error.message, /requestDelayMs/);
      return true;
    },
  );
});

test("limit dışı hata olduğu gibi yükselir", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw apiError(400);
    },
  });

  await assert.rejects(
    callModel({ model, config: CONFIG, system: "s", prompt: "p" }),
    (error: Error) => {
      assert.equal(error instanceof CapacityError, false);
      return true;
    },
  );
});

test("sözleşmeye uymayan çıktı sessizce boş geçmez", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => textResponse(JSON.stringify({ kind: "script", files: [] })),
  });

  // files boş: şema en az bir dosya istiyor, çünkü boş çıktı "hata yok" gibi
  // görünür ve vaka yanlışlıkla geçmiş sayılabilirdi.
  await assert.rejects(callModel({ model, config: CONFIG, system: "s", prompt: "p" }));
});

test("RetryError'ın sardığı kota hatası da tanınır", () => {
  // AI SDK denemeleri tükettiğinde RetryError fırlatıyor ve asıl sebebi
  // `cause` ile değil `lastError` / `errors` ile taşıyor. İlk gerçek kapı
  // koşusunda kota hatası bu yüzden "model düştü" diye raporlandı.
  const inner = apiError(429);
  const retry = Object.assign(new Error("Failed after 2 attempts"), {
    lastError: inner,
    errors: [inner, inner],
  });
  assert.equal(isCapacityError(retry), true);

  // Sarılan hata kapasite dışıysa hâlâ model hatası sayılır.
  const other = Object.assign(new Error("Failed after 2 attempts"), {
    lastError: apiError(400),
    errors: [apiError(400)],
  });
  assert.equal(isCapacityError(other), false);
});
