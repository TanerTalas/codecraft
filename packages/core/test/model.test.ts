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
import { callModel, isRateLimit, RateLimitError } from "../src/model.ts";
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

test("429 limit olarak tanınır", () => {
  assert.equal(isRateLimit(apiError(429)), true);
  // SDK denemeleri tükettiğinde hatayı sarmalayarak fırlatıyor.
  assert.equal(isRateLimit(new Error("tükendi", { cause: apiError(429) })), true);
});

test("diğer hatalar limit sayılmaz", () => {
  assert.equal(isRateLimit(apiError(400)), false);
  assert.equal(isRateLimit(apiError(500)), false);
  assert.equal(isRateLimit(new Error("düz hata")), false);
});

test("limit hatası RateLimitError'a çevrilir ve ne yapılacağını söyler", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw apiError(429);
    },
  });

  await assert.rejects(
    callModel({ model, config: CONFIG, system: "s", prompt: "p" }),
    (error: Error) => {
      assert.ok(error instanceof RateLimitError);
      assert.match(error.message, /429/);
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
      assert.equal(error instanceof RateLimitError, false);
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
