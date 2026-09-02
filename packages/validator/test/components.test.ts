/**
 * components.ts — bileşen adları ve afterEvent sırası.
 *
 * NEDEN BU KONTROL VAR: ne Blockception ne Mojang şemaları bilinmeyen bir
 * bileşen adını reddediyor. `packages/validator/test/fixtures/cases.json`
 * içindeki `block-unknown-component` vakası tam bunu ölçüyor ve beklenen
 * sonucu "pass" — yani iki şema kaynağı da geçiriyor. Bu dosya o boşluğun
 * kapandığını sabitliyor.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { componentIndex, eventOrder } from "@codecraft/knowledge";

import { checkComponents, type PackFile } from "../src/index.ts";

const file = (path: string, value: unknown): PackFile => ({
  path,
  content: JSON.stringify(value, null, 2),
});

const block = (components: Record<string, unknown>): PackFile =>
  file("blocks/ruby.json", {
    format_version: "1.21.100",
    "minecraft:block": {
      description: { identifier: "codecraft:ruby_block" },
      components,
    },
  });

test("bilinmeyen blok bileşeni yakalanır ve yakın ad önerilir", async () => {
  const result = await checkComponents([block({ "minecraft:destructable": {} })]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.check, "component");
  // Öneri olmadan "bu yok" demek modele ne yazacağını söylemiyor.
  assert.match(result.findings[0]?.message ?? "", /minecraft:destructible_by_mining/);
});

test("kontrol grubu: doğru yazılmış aynı bileşen temiz geçer", async () => {
  const result = await checkComponents([
    block({ "minecraft:destructible_by_mining": { seconds_to_destroy: 1 } }),
  ]);
  assert.deepEqual(result.findings, []);
});

test("özel namespace'li anahtar bileşen sayılmıyor", async () => {
  // Kullanıcının kendi verisi olabilir; ona "bilinmiyor" demek uydurma hata.
  const result = await checkComponents([block({ "codecraft:custom_data": { x: 1 } })]);
  assert.deepEqual(result.findings, []);
});

test("permütasyon içindeki bileşen de ölçülüyor", async () => {
  const result = await checkComponents([
    file("blocks/ruby.json", {
      "minecraft:block": {
        description: { identifier: "codecraft:ruby_block" },
        permutations: [{ condition: "q.block_state('x')", components: { "minecraft:yok_boyle_bir_sey": {} } }],
      },
    }),
  ]);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0]?.message ?? "", /permutations/);
});

test("entity component_groups altındaki bileşen de ölçülüyor", async () => {
  const result = await checkComponents([
    file("entities/guard.json", {
      "minecraft:entity": {
        description: { identifier: "codecraft:guard" },
        component_groups: { angry: { "minecraft:uydurma_bilesen": {} } },
      },
    }),
  ]);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0]?.message ?? "", /component_groups\/angry/);
});

test("AI hedefi entity bileşeni sayılıyor", async () => {
  // AI hedefleri ayrı bir dokümantasyon bölümünde ama components altına
  // yazılıyorlar. Bölümleri birleştirmeseydik hepsi yanlış pozitif olurdu.
  const index = await componentIndex();
  const goal = index.entityGoals[0];
  assert.ok(goal, "fixture varsayımı: en az bir AI hedefi olmalı");

  const result = await checkComponents([
    file("entities/guard.json", {
      "minecraft:entity": { description: { identifier: "codecraft:guard" }, components: { [goal]: {} } },
    }),
  ]);
  assert.deepEqual(result.findings, []);
});

test("dahili olay adı bileşen olarak kabul EDİLMİYOR", async () => {
  // entityEvents bilerek birleşime girmiyor: olay adını bileşen yerine yazmak
  // gerçek bir hata ve kümeleri tek torbaya koysaydık geçerdi.
  const index = await componentIndex();
  const event = index.entityEvents[0];
  assert.ok(event, "fixture varsayımı: en az bir dahili olay olmalı");

  const result = await checkComponents([
    file("entities/guard.json", {
      "minecraft:entity": { description: { identifier: "codecraft:guard" }, components: { [event]: {} } },
    }),
  ]);
  assert.equal(result.findings.length, 1);
});

test("hepsi warning — dokümantasyon oyunun gerisinde kalabiliyor", async () => {
  const result = await checkComponents([block({ "minecraft:yok_boyle_bir_sey": {} })]);
  assert.equal(result.ok, true);
  assert.equal(result.findings[0]?.severity, "warning");
});

test("bileşen taşımayan doküman tipleri hiç taranmıyor", async () => {
  const result = await checkComponents([
    file("recipes/x.json", { "minecraft:recipe_shaped": { result: { item: "minecraft:stone" } } }),
  ]);
  assert.deepEqual(result.findings, []);
});

// --------------------------------------------------------------------------
// afterEvent sırası
// --------------------------------------------------------------------------

test("afterEvent sırası modül sürümü başına okunabiliyor", async () => {
  const order = await eventOrder();
  const versions = Object.keys(order);
  assert.ok(versions.length > 1, "birden fazla modül sürümü olmalı");

  // D sınıfının veri ayağı: hangi olayın var olduğu buradan okunuyor.
  const anyOrder = order[versions[0] as string];
  assert.ok(Array.isArray(anyOrder) && anyOrder.length > 0);
  assert.ok(anyOrder.every((name) => name.endsWith("AfterEvent")));
});
