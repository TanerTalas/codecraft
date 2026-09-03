/**
 * H sınıfı: sürüme bağlı zorunlu alan.
 *
 * ÖLÇÜM 03-09-2026, gerçek oyunda: `format_version 1.21.100` taşıyan bir
 * `recipe_shaped`, `unlock` alanı olmadığı için hiç yüklenmedi ve ContentLog
 * "1.20+ Recipes require unlock data" yazdı. Şema bunu yakalayamıyor —
 * Blockception `unlock`'u tanıyor ama hiçbir tipte zorunlu tutmuyor.
 *
 * Kapsam vanilla'dan 90 tarif örneklenerek ölçüldü; ayrıntı checks.ts
 * başlığında. Aşağıdaki testler o ölçümün sınırlarını sabitliyor: kural
 * crafting table tariflerinde ve yalnızca 1.20+ için geçerli.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkRecipes, type PackFile } from "../src/index.ts";

const file = (body: unknown): PackFile => ({
  path: "recipes/x.json",
  content: JSON.stringify(body),
});

const shaped = (formatVersion: string, extra: Record<string, unknown> = {}): PackFile =>
  file({
    format_version: formatVersion,
    "minecraft:recipe_shaped": {
      description: { identifier: "codecraft:ruby_block" },
      tags: ["crafting_table"],
      pattern: ["RRR", "RRR", "RRR"],
      key: { R: { item: "codecraft:ruby" } },
      result: { item: "codecraft:ruby_block" },
      ...extra,
    },
  });

test("1.20+ shaped tarif unlock olmadan error veriyor", () => {
  const result = checkRecipes([shaped("1.21.100")]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.check, "recipe-unlock");
  assert.equal(result.findings[0]?.severity, "error");
  assert.equal(result.ok, false);
  // Ne yazacağı söylenmeli, yoksa "eksik" demek çözüm üretmiyor.
  assert.match(result.findings[0]?.message ?? "", /AlwaysUnlocked/);
});

test("kontrol grubu: unlock varsa temiz geçiyor", () => {
  const withItem = checkRecipes([shaped("1.21.100", { unlock: [{ item: "codecraft:ruby" }] })]);
  assert.deepEqual(withItem.findings, []);

  const withContext = checkRecipes([shaped("1.21.100", { unlock: { context: "AlwaysUnlocked" } })]);
  assert.deepEqual(withContext.findings, []);
});

test("1.20 ÖNCESİ tarif uyarı almıyor", () => {
  // Ölçüldü: vanilla'da 1.12 ve 1.16 tariflerinin 11'inde de unlock YOK.
  // Onlara "eksik" demek uydurma hata olurdu.
  for (const version of ["1.12", "1.16", "1.19.80"]) {
    assert.deepEqual(checkRecipes([shaped(version)]).findings, [], `${version} uyarı üretti`);
  }
});

test("shapeless de kapsamda", () => {
  const result = checkRecipes([
    file({
      format_version: "1.20.10",
      "minecraft:recipe_shapeless": {
        description: { identifier: "codecraft:x" },
        tags: ["crafting_table"],
        ingredients: [{ item: "codecraft:ruby" }],
        result: { item: "codecraft:ruby_block" },
      },
    }),
  ]);
  assert.equal(result.findings.length, 1);
});

test("brewing ve smithing kapsam DIŞINDA", () => {
  // Ölçüldü: ikisi de 1.20.10 formatında bile unlock taşımıyor
  // (brewing_mix 0/4, smithing_transform 0/1). Kapsama alsaydık her modern
  // brewing tarifine uydurma hata üretirdik.
  const brewing = checkRecipes([
    file({
      format_version: "1.20.10",
      "minecraft:recipe_brewing_mix": {
        description: { identifier: "codecraft:brew" },
        tags: ["brewing_stand"],
        input: "minecraft:potion",
        reagent: "minecraft:redstone",
        output: "minecraft:potion",
      },
    }),
  ]);
  assert.deepEqual(brewing.findings, []);

  const smithing = checkRecipes([
    file({
      format_version: "1.20.10",
      "minecraft:recipe_smithing_transform": {
        description: { identifier: "codecraft:smith" },
        tags: ["smithing_table"],
        base: "minecraft:diamond_sword",
        addition: "minecraft:netherite_ingot",
        result: "minecraft:netherite_sword",
      },
    }),
  ]);
  assert.deepEqual(smithing.findings, []);
});
