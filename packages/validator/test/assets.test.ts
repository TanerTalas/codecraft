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
  assert.match(finding?.message ?? "", /Nearest keys: .*ore/);
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
  assert.match(result.findings[0]?.message ?? "", /it is in the terrain atlas/);
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

/**
 * Paketin KENDİ atlas tanımı.
 *
 * Ölçüldü 01-09-2026, docs/mcp-kullanim.md senaryo 5: model kaynak paketi de üreten
 * eksiksiz bir eklenti verdi, doku anahtarlarını RP içinde tanımladı, ve
 * review_pack iki ERROR ile ok:false döndü. Doğru ve kurulabilir bir paket
 * "hatalı" raporlandı — yanlış pozitif.
 *
 * Model bulguyu haklı olarak yok saydı. Asıl tehlike o: aracın kendi hataları
 * modele "bu aracın hatalarını yok say" öğretir ve o alışkanlık gerçek bir
 * hatayı da yok saydırır.
 */
const terrainAtlas = JSON.stringify({
  resource_pack_name: "yakut",
  texture_name: "atlas.terrain",
  texture_data: { yakut_cevheri: { textures: "textures/blocks/yakut_cevheri" } },
});

const itemAtlas = JSON.stringify({
  resource_pack_name: "yakut",
  texture_name: "atlas.items",
  texture_data: { yakut: { textures: "textures/items/yakut" } },
});

test("paketin kendi atlas tanımındaki anahtar çözülüyor", async () => {
  const result = await checkAssets([
    { path: "BP/blocks/yakut_cevheri.json", content: block("yakut_cevheri") },
    { path: "BP/items/yakut.json", content: item("yakut") },
    { path: "RP/textures/terrain_texture.json", content: terrainAtlas },
    { path: "RP/textures/item_texture.json", content: itemAtlas },
  ]);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.findings.length, 0);
});

test("atlas tanımı yoksa aynı anahtar hâlâ hata veriyor", async () => {
  // Kontrol grubu. Düzeltmenin denetimi KAPATMADIĞINI ölçüyor — bu test
  // olmasa "hep geçiyor" ile "doğru geçiyor" ayırt edilemezdi.
  const result = await checkAssets([
    { path: "BP/blocks/yakut_cevheri.json", content: block("yakut_cevheri") },
    { path: "BP/items/yakut.json", content: item("yakut") },
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 2);
  for (const finding of result.findings) {
    assert.equal(finding.severity, "error");
    assert.equal(finding.check, "asset");
  }
});

test("atlas ayrımı texture_name yoksa dosya adından okunuyor", async () => {
  const isimsiz = JSON.stringify({
    texture_data: { yakut_cevheri: { textures: "textures/blocks/yakut_cevheri" } },
  });
  const result = await checkAssets([
    { path: "BP/blocks/yakut_cevheri.json", content: block("yakut_cevheri") },
    { path: "RP/textures/terrain_texture.json", content: isimsiz },
  ]);
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});
