/**
 * normalize'ın testi negatif kontrol biçiminde kurulu: çıktısı her zaman
 * checkFileNames'i geçmeli. Yani "düzeltiyor" iddiası, kuralı ölçen
 * fonksiyonun kendisiyle sınanıyor — iki taraf ayrışamaz.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkFileNames } from "@codecraft/validator";

import { normalize } from "../src/normalize.ts";

const featureRule = (identifier: string): string =>
  JSON.stringify({
    format_version: "1.13.0",
    "minecraft:feature_rules": {
      description: { identifier, places_feature: "codecraft:ruby_ore_scatter" },
    },
  });

test("yanlış adlandırılmış feature rule dosyası düzeltilir", () => {
  const input = [
    { path: "BP/feature_rules/ruby_ore.json", content: featureRule("codecraft:ruby_ore_feature") },
  ];

  // Önce kural gerçekten ihlal ediliyor olmalı, yoksa test bir şey ölçmez.
  assert.equal(checkFileNames(input).ok, false);

  const result = normalize(input);
  assert.equal(result.files[0]?.path, "BP/feature_rules/ruby_ore_feature.json");
  assert.equal(result.fixes.length, 1);
  assert.equal(result.fixes[0]?.from, "BP/feature_rules/ruby_ore.json");
  assert.equal(checkFileNames(result.files).ok, true);
});

test("adı zaten doğru olan dosyaya dokunulmaz", () => {
  const input = [
    {
      path: "BP/feature_rules/ruby_ore_feature.json",
      content: featureRule("codecraft:ruby_ore_feature"),
    },
  ];
  const result = normalize(input);
  assert.deepEqual(result.fixes, []);
  assert.deepEqual(result.files, input);
});

test("namespace'siz identifier de çalışır", () => {
  const result = normalize([
    { path: "BP/feature_rules/yanlis.json", content: featureRule("ruby_ore_feature") },
  ]);
  assert.equal(result.files[0]?.path, "BP/feature_rules/ruby_ore_feature.json");
});

test("ayrıştırılamayan JSON'a dokunulmaz", () => {
  // validateJson bunu zaten ayrıntısıyla raporluyor; burada tahmin yürütmek
  // içeriği bozmaktan başka işe yaramaz.
  const input = [{ path: "BP/feature_rules/bozuk.json", content: "{ bozuk" }];
  const result = normalize(input);
  assert.deepEqual(result.files, input);
  assert.deepEqual(result.fixes, []);
});

test("script ve diğer dosyalar aynen geçer", () => {
  const input = [
    { path: "BP/scripts/main.js", content: "// kod" },
    { path: "answer.txt", content: "/give @s minecraft:diamond 64" },
  ];
  assert.deepEqual(normalize(input).files, input);
});

test("feature rule olmayan JSON'lar düzeltilmez", () => {
  const input = [
    {
      path: "BP/blocks/farkli_ad.json",
      content: JSON.stringify({
        format_version: "1.21.0",
        "minecraft:block": { description: { identifier: "codecraft:ruby_ore" } },
      }),
    },
  ];
  // Blok dosyaları için böyle bir kural ÖLÇÜLMEDİ, o yüzden uygulanmıyor.
  assert.deepEqual(normalize(input).fixes, []);
});

test("eski script modülü tipi düzeltilir", async () => {
  // Şemadan geçen ama oyunun yüklemediği biçim. 30-08-2026'da gerçek oyunda
  // ölçüldü: paket davranış paketleri listesinde hiç görünmedi, yalnızca bu
  // alan düzeltilince göründü ve script çalıştı.
  const { checkManifest } = await import("@codecraft/validator");

  const input = [
    {
      path: "BP/manifest.json",
      content: JSON.stringify({
        format_version: 2,
        header: { name: "x" },
        modules: [{ type: "javascript", entry: "scripts/main.js", uuid: "u", version: [1, 0, 0] }],
      }),
    },
  ];

  // Önce kural gerçekten ihlal ediliyor olmalı, yoksa test bir şey ölçmez.
  assert.equal(checkManifest(input).ok, false);

  const result = normalize(input);
  assert.equal(result.fixes.length, 1);
  assert.equal(result.fixes[0]?.rule, "manifest");

  // Negatif kontrol: düzeltilen çıktı artık kontrolü geçmeli.
  assert.equal(checkManifest(result.files).ok, true);

  const module = JSON.parse(result.files[0]?.content ?? "{}").modules[0];
  assert.equal(module.type, "script");
  assert.equal(module.language, "javascript");
  assert.equal(module.entry, "scripts/main.js");
});

test("doğru manifest'e dokunulmaz", () => {
  const input = [
    {
      path: "BP/manifest.json",
      content: JSON.stringify({
        modules: [{ type: "script", language: "javascript", entry: "scripts/main.js" }],
      }),
    },
  ];
  const result = normalize(input);
  assert.deepEqual(result.fixes, []);
  assert.deepEqual(result.files, input);
});
