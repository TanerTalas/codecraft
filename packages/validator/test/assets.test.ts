/**
 * C sınıfı: varlık (asset) referansları — docs/VALIDATION-LIMITS.md.
 *
 * Ölçülen şey "bir hata çıktı" değil, DOĞRU dosyada DOĞRU anahtar için doğru
 * hatanın çıkması. Gerçek `data/<sürüm>/textures.json`'a karşı koşuyor,
 * sahte veri yok.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { checkAssets } from "../src/index.ts";

const item = (icon: unknown): string =>
  JSON.stringify({
    format_version: "1.21.100",
    "minecraft:item": {
      description: { identifier: "codecraft:ruby" },
      components: { "minecraft:icon": icon },
    },
  });

const block = (texture: string): string =>
  JSON.stringify({
    format_version: "1.21.100",
    "minecraft:block": {
      description: { identifier: "codecraft:ruby_ore" },
      components: {
        "minecraft:material_instances": { "*": { texture, render_method: "opaque" } },
      },
    },
  });

test("var olan vanilla ikonu geçer — düz metin biçimi", async () => {
  const result = await checkAssets([{ path: "BP/items/ruby.json", content: item("diamond") }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("var olan vanilla ikonu geçer — textures.default biçimi", async () => {
  const result = await checkAssets([
    { path: "BP/items/ruby.json", content: item({ textures: { default: "diamond" } }) },
  ]);
  assert.equal(result.ok, true);
});

test("var olan vanilla ikonu geçer — texture biçimi", async () => {
  const result = await checkAssets([
    { path: "BP/items/ruby.json", content: item({ texture: "diamond" }) },
  ]);
  assert.equal(result.ok, true);
});

test("olmayan ikon reddedilir ve doğru dosyada raporlanır", async () => {
  const result = await checkAssets([{ path: "BP/items/ruby.json", content: item("ruby") }]);

  assert.equal(result.ok, false);
  const finding = result.findings[0];
  assert.equal(finding?.check, "asset");
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.path, "BP/items/ruby.json");
  assert.match(finding?.message ?? "", /"ruby"/);
});

test("olmayan blok dokusu reddedilir ve yakın anahtar önerilir", async () => {
  const result = await checkAssets([
    { path: "BP/blocks/ruby_ore.json", content: block("ruby_ore") },
  ]);

  assert.equal(result.ok, false);
  const finding = result.findings[0];
  assert.equal(finding?.severity, "error");
  // Öneri olmadan retry modele ne yazacağını söylemiyor.
  assert.match(finding?.message ?? "", /Yakın anahtarlar: .*ore/);
});

test("var olan blok dokusu geçer", async () => {
  const result = await checkAssets([
    { path: "BP/blocks/x.json", content: block("diamond_ore") },
  ]);
  assert.equal(result.ok, true);
});

test("yanlış atlas hata değil uyarı — anahtar gerçekten var", async () => {
  // "grass_side" terrain atlasında var, item atlasında yok.
  const result = await checkAssets([
    { path: "BP/items/x.json", content: item("grass_side") },
  ]);

  assert.equal(result.ok, true, "uyarı sonucu düşürmemeli");
  assert.equal(result.findings[0]?.severity, "warning");
  assert.match(result.findings[0]?.message ?? "", /terrain atlasında/);
});

test("doku referansı olmayan dosyada kontrol sessiz", async () => {
  const recipe = JSON.stringify({
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: "codecraft:x" },
      ingredients: [{ item: "minecraft:diamond" }],
      result: { item: "minecraft:diamond_block" },
    },
  });
  const result = await checkAssets([{ path: "BP/recipes/x.json", content: recipe }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("permutations altındaki doku da taranır", async () => {
  const content = JSON.stringify({
    format_version: "1.21.100",
    "minecraft:block": {
      description: { identifier: "codecraft:x" },
      components: { "minecraft:material_instances": { "*": { texture: "diamond_ore" } } },
      permutations: [
        {
          condition: "q.block_state('codecraft:lit') == 1",
          components: { "minecraft:material_instances": { "*": { texture: "uydurma_doku" } } },
        },
      ],
    },
  });

  const result = await checkAssets([{ path: "BP/blocks/x.json", content }]);
  assert.equal(result.ok, false, "permutations içindeki doku gözden kaçtı");
  assert.match(result.findings[0]?.message ?? "", /uydurma_doku/);
});
