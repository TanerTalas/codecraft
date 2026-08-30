/**
 * Üretim döngüsünün testi — sahte modelle, ağ ve kota harcamadan.
 *
 * Ölçülen asıl şey retry: ilk denemede doğrulamadan geçmeyen bir çıktı
 * verildiğinde ikinci istem hata metnini taşıyor mu, ve ikinci deneme
 * geçtiğinde sonuç "geçti" oluyor mu. Ürünün genel modellerden farkı bu
 * döngü (docs/ROADMAP.md), o yüzden testi de burada.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import type { Config } from "../src/config.ts";
import { generate } from "../src/generate.ts";
import type { Generation } from "../src/output.ts";
import type { Review, ReviewFn } from "../src/review.ts";
import { textResponse } from "./helpers.ts";

const CONFIG: Config = {
  provider: "google",
  model: "sahte-model",
  maxOutputTokens: 4096,
  temperature: 0,
  maxRetries: 0,
  requestDelayMs: 0,
};

/** Sırayla verilen çıktıları döndüren model. Gelen istemleri kaydeder. */
function scriptedModel(outputs: Generation[]): {
  model: MockLanguageModelV4;
  prompts: string[];
} {
  const prompts: string[] = [];
  let call = 0;

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      for (const message of options.prompt) {
        if (message.role !== "user") continue;
        for (const part of message.content) {
          if (part.type === "text") prompts.push(part.text);
        }
      }
      const output = outputs[Math.min(call, outputs.length - 1)] as Generation;
      call += 1;
      return textResponse(JSON.stringify(output));
    },
  });

  return { model, prompts };
}

const passing = (): Review => ({
  measured: true,
  validation: true,
  files: [],
  findings: [],
  ok: true,
  report: "",
});

const failing = (report: string): Review => ({
  measured: true,
  validation: false,
  files: [],
  findings: [],
  ok: false,
  report,
});

/** Verilen sıraya göre sonuç döndüren sahte doğrulayıcı. */
const scriptedReview = (results: Review[]): ReviewFn => {
  let call = 0;
  return async () => results[Math.min(call++, results.length - 1)] as Review;
};

const FILE = { path: "BP/scripts/main.js", content: "// kod" };

test("ilk deneme geçerse retry koşmaz", async () => {
  const { model, prompts } = scriptedModel([{ kind: "script", files: [FILE] }]);

  const result = await generate("Düşerken hasar almayayım", {
    config: CONFIG,
    model,
    review: scriptedReview([passing()]),
  });

  assert.equal(result.status, "generated");
  if (result.status !== "generated") return;
  assert.equal(result.attempts.length, 1);
  assert.equal(result.ok, true);
  assert.equal(prompts.length, 1);
});

test("ilk deneme düşerse hata metniyle tek retry koşar", async () => {
  const { model, prompts } = scriptedModel([
    { kind: "script", files: [{ ...FILE, content: "world.events.x" }] },
    { kind: "script", files: [FILE] },
  ]);

  const result = await generate("Düşerken hasar almayayım", {
    config: CONFIG,
    model,
    review: scriptedReview([
      failing("main.js: 2:1 TS2339: Property 'events' does not exist"),
      passing(),
    ]),
  });

  assert.equal(result.status, "generated");
  if (result.status !== "generated") return;
  assert.equal(result.attempts.length, 2);
  assert.equal(result.ok, true);

  // İkinci istem hata metnini taşımalı, yoksa retry bir şey öğretmiyor demektir.
  assert.equal(prompts.length, 2);
  assert.match(prompts[1] as string, /TS2339/);
  assert.match(prompts[1] as string, /Düşerken hasar almayayım/);
});

test("retry de düşerse tam iki deneme yapılır ve sonuç düşük döner", async () => {
  const { model, prompts } = scriptedModel([{ kind: "script", files: [FILE] }]);

  const result = await generate("Düşerken hasar almayayım", {
    config: CONFIG,
    model,
    review: scriptedReview([failing("bir hata"), failing("hâlâ hata")]),
  });

  assert.equal(result.status, "generated");
  if (result.status !== "generated") return;
  // Tek retry: üçüncü bir deneme yok (TODO.md Aşama 3).
  assert.equal(result.attempts.length, 2);
  assert.equal(prompts.length, 2);
  assert.equal(result.ok, false);
});

test("yapılabilirlik engellerse model hiç çağrılmaz", async () => {
  const { model, prompts } = scriptedModel([{ kind: "script", files: [FILE] }]);
  let reviewed = false;

  const result = await generate("Fareme basılı tutmuş gibi otomatik kazsın", {
    config: CONFIG,
    model,
    review: async () => {
      reviewed = true;
      return passing();
    },
  });

  assert.equal(result.status, "infeasible");
  assert.deepEqual(prompts, []);
  assert.equal(reviewed, false);
});

test("dosya adı düzeltmesi doğrulamadan önce uygulanır", async () => {
  const featureRule = JSON.stringify({
    format_version: "1.13.0",
    "minecraft:feature_rules": {
      description: {
        identifier: "codecraft:ruby_ore_feature",
        places_feature: "codecraft:ruby_ore_scatter",
      },
    },
  });

  const { model } = scriptedModel([
    { kind: "json", files: [{ path: "BP/feature_rules/ruby_ore.json", content: featureRule }] },
  ]);

  let seen: readonly { path: string }[] = [];
  const result = await generate("Yakut cevheri doğal oluşsun", {
    config: CONFIG,
    model,
    review: async (files) => {
      seen = files;
      return passing();
    },
  });

  // Doğrulayıcı düzeltilmiş adı görmeli: bu bir üretim hatası, modele geri
  // sorulacak bir şey değil (docs/VALIDATION-LIMITS.md B).
  assert.equal(seen[0]?.path, "BP/feature_rules/ruby_ore_feature.json");
  assert.equal(result.status, "generated");
  if (result.status !== "generated") return;
  assert.equal(result.attempts[0]?.fixes.length, 1);
});
