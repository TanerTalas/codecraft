/**
 * Prompt saf bir fonksiyon: ağ yok, dosya yok, ölçmesi ucuz.
 *
 * Ölçülen şey, prompt'un CLAUDE.md'deki sürüm tuzağını ve checks.ts'deki
 * kalıp tablosunu gerçekten taşıdığı. İkisi de "unutulunca sessizce kötüleşen"
 * türden.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { patternNames } from "@codecraft/validator";

import type { Context } from "../src/context.ts";
import { buildRetryPrompt, buildSystemPrompt } from "../src/prompt.ts";
import type { Review } from "../src/review.ts";

const context = (overrides: Partial<Context> = {}): Context => ({
  version: "1.26.40.5",
  minEngineVersion: [1, 26, 40],
  formatVersion: "1.26.40",
  modules: { "@minecraft/server": "2.9.0" },
  documentTypes: ["behavior/blocks/blocks"],
  patterns: [{ name: "bir-kalip", guidance: "şöyle yaz", evidence: "ölçüldü" }],
  identities: [],
  ...overrides,
});

test("sürüm biçimi ve modül sürümü ayrı ayrı yazılıyor", () => {
  const prompt = buildSystemPrompt(context());
  assert.match(prompt, /1\.26\.40/);
  assert.match(prompt, /\[1, 26, 40\]/);
  assert.match(prompt, /@minecraft\/server": "2\.9\.0/);
  // Pazarlama numarası yasağı prompt'ta açıkça duruyor.
  assert.match(prompt, /[Pp]azarlama numarası/);
});

test("kalıp tablosu prompt'a giriyor", () => {
  const prompt = buildSystemPrompt(context());
  assert.match(prompt, /bir-kalip/);
  assert.match(prompt, /şöyle yaz/);
});

test("gerçek kalıp tablosundaki her kalıp anlatılabiliyor", () => {
  // checks.ts'e kalıp eklenip guidance yazılmazsa burada görünür.
  const names = patternNames();
  assert.ok(names.length > 0);
  const prompt = buildSystemPrompt(
    context({
      patterns: names.map((name) => ({ name, guidance: `${name} rehberi`, evidence: "x" })),
    }),
  );
  for (const name of names) assert.match(prompt, new RegExp(name));
});

test("doğrulanmış kimlikler prompt'a giriyor", () => {
  const prompt = buildSystemPrompt(
    context({
      identities: [
        { id: "minecraft:diamond", found: true, kind: "item" },
        { id: "minecraft:ruby", found: false, kind: null },
      ],
    }),
  );
  assert.match(prompt, /minecraft:diamond — var \(item\)/);
  assert.match(prompt, /minecraft:ruby — bu sürümde YOK/);
});

test("retry istemi hata metnini taşır", () => {
  const review: Review = {
    measured: true,
    validation: false,
    files: [],
    findings: [],
    ok: false,
    report: "main.js: TS2339 yok böyle bir alan",
  };
  const prompt = buildRetryPrompt(review);
  assert.match(prompt, /TS2339/);
  assert.match(prompt, /düzelt/i);
});
