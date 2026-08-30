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
  engineVersion: "1.26.40",
  formatVersions: { "behavior/spawn_rules/spawn_rules": ["1.8.0"] },
  modules: { "@minecraft/server": "2.9.0" },
  documentTypes: ["behavior/blocks/blocks"],
  patterns: [{ name: "bir-kalip", guidance: "şöyle yaz", evidence: "ölçüldü" }],
  textures: { item: 498, terrain: 1300 },
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

test("ölçülmüş 1.x kalıntıları prompt'ta adıyla yazılı", () => {
  // Üçü de gerçek koşularda modelin ürettiği hâliyle görüldü:
  //   world.events       eval, mob-timer-01 notu
  //   runCommandAsync    CLI'ın ilk uçtan uca koşusu, retry ikinci denemede soktu
  //   worldInitialize    kapı koşusu, kill-counter-01
  const prompt = buildSystemPrompt(context());
  assert.match(prompt, /world\.events/);
  assert.match(prompt, /runCommandAsync/);
  assert.match(prompt, /worldInitialize/);
  assert.match(prompt, /worldLoad/);
  assert.match(prompt, /afterEvents/);
});

test("null denetimi uyarısı prompt'ta", () => {
  // strictNullChecks açık kalıyor çünkü getBlock() gerçekten undefined
  // dönebiliyor ve kontrolsüz kullanım oyunda çöküyor. Model bunu önceden
  // bilmeli, retry'da öğrenmek zorunda kalmamalı.
  assert.match(buildSystemPrompt(context()), /undefined/);
});

test("format_version oyun sürümüyle karıştırılmıyor", () => {
  // İlk gerçek kapı koşusunun bulduğu hata: prompt "format_version her zaman
  // 1.26.xx" diyordu, model uydu, spawn rules şeması reddetti. format_version
  // dosya tipinin kendi şema sürümü, oyun sürümü değil.
  const prompt = buildSystemPrompt(context());
  assert.match(prompt, /`format_version` oyun sürümü DEĞİL/);
  // Tipe özel değerler listeleniyor ve veriden geliyor.
  assert.match(prompt, /spawn_rules 1\.8\.0/);
});

test("format_version listesi boşsa bölüm hiç basılmıyor", () => {
  // Uydurma değer üretmektense hiç söylememek yeğ.
  const prompt = buildSystemPrompt(context({ formatVersions: {} }));
  assert.equal(prompt.includes("## format_version"), false);
});
