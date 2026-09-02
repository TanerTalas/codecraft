/**
 * checks.ts — şemanın ve tsc'nin yakalayamadığı üç sınıf.
 *
 * Her kontrolün iki yönü de ölçülür: doğru girdi geçmeli, bozuk girdi
 * yakalanmalı. json.test.ts'teki negatif kontrol kalıbının aynısı — bir
 * kontrolün sadece yeşil vermesi gerçekten baktığını göstermez.
 *
 * Bozuk vakalar uydurma değil: üçü de 30-08-2026'da gerçek oyunda ölçüldü
 * (docs/VALIDATION-LIMITS.md).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkFileNames,
  checkIdentities,
  checkPatterns,
  patternNames,
  type PackFile,
} from "../src/index.ts";

const VALID = fileURLToPath(new URL("./fixtures/valid/", import.meta.url));

const fixture = async (name: string, path: string): Promise<PackFile> => ({
  path,
  content: await readFile(join(VALID, name), "utf8"),
});

const file = (path: string, value: unknown): PackFile => ({
  path,
  content: JSON.stringify(value, null, 2),
});

// --------------------------------------------------------------------------
// A · kimlik referansları
// --------------------------------------------------------------------------

test("A: tarif sonucu pakette tanımlı değilse yakalanır", async () => {
  // Oyunun gerçekten verdiği hata: "The Item: codecraft:ruby_block is missing
  // or invalid, can't make the recipe". Tarifin kendi identifier'ı da
  // codecraft:ruby_block — ama tarif kimliği item'ı var etmiyor.
  const recipe = await fixture("recipe-ruby-block.json", "recipes/ruby_block.json");
  const item = await fixture("item-ruby.json", "items/ruby.json");

  const result = await checkIdentities([recipe, item]);

  assert.equal(result.ok, false, "tanımsız result.item geçmemeliydi");
  const paths = result.findings.map((finding) => finding.message);
  assert.ok(
    paths.some((message) => message.includes("codecraft:ruby_block")),
    `codecraft:ruby_block bekleniyordu, çıkanlar: ${JSON.stringify(paths)}`,
  );
  // codecraft:ruby (key.R) item dosyasında tanımlı — o şikâyet üretmemeli.
  assert.ok(
    !paths.some((message) => message.includes('"codecraft:ruby"')),
    "pakette tanımlı olan codecraft:ruby yanlışlıkla yakalandı",
  );
});

test("A: eksik item tanımlanınca aynı tarif geçiyor", async () => {
  const recipe = await fixture("recipe-ruby-block.json", "recipes/ruby_block.json");
  const item = await fixture("item-ruby.json", "items/ruby.json");
  const block = file("blocks/ruby_block.json", {
    format_version: "1.21.100",
    "minecraft:block": { description: { identifier: "codecraft:ruby_block" } },
  });

  const result = await checkIdentities([recipe, item, block]);
  assert.equal(result.ok, true, `hata bekleniyordu: ${JSON.stringify(result.findings)}`);
});

test("A: var olan vanilla kimliği geçiyor, uydurulmuş olan yakalanıyor", async () => {
  const good = file("recipes/sticks.json", {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: "codecraft:sticks" },
      tags: ["crafting_table"],
      ingredients: [{ item: "minecraft:diamond" }],
      result: { item: "minecraft:stick" },
    },
  });
  assert.equal((await checkIdentities([good])).ok, true);

  const bad = file("recipes/sticks.json", {
    format_version: "1.21.100",
    "minecraft:recipe_shapeless": {
      description: { identifier: "codecraft:sticks" },
      tags: ["crafting_table"],
      ingredients: [{ item: "minecraft:rubby" }],
      result: { item: "minecraft:stick" },
    },
  });
  const result = await checkIdentities([bad]);
  assert.equal(result.ok, false, "minecraft:rubby diye bir item yok, geçmemeliydi");
  assert.ok(result.findings.some((finding) => finding.message.includes("minecraft:rubby")));
});

test("A: spawn kuralı var olmayan entity'ye yazılamaz", async () => {
  const orphan = await fixture("spawn-rules-guard.json", "spawn_rules/guard.json");
  assert.equal((await checkIdentities([orphan])).ok, false);

  const entity = await fixture("entity-guard.json", "entities/guard.json");
  assert.equal(
    (await checkIdentities([orphan, entity])).ok,
    true,
    "entity tanımlıyken spawn kuralı geçmeliydi",
  );

  const vanilla = file("spawn_rules/zombie.json", {
    format_version: "1.8.0",
    "minecraft:spawn_rules": {
      description: { identifier: "minecraft:zombie", population_control: "monster" },
      conditions: [],
    },
  });
  assert.equal((await checkIdentities([vanilla])).ok, true, "vanilla entity geçmeliydi");
});

test("A: places_feature tanımsızsa yakalanır, tanımlıysa geçer", async () => {
  // Oyunun verdiği hata: "No definition found for feature
  // 'codecraft:ruby_ore_scatter'".
  const rule = await fixture("feature-rules-ruby-ore.json", "feature_rules/ruby_ore_feature.json");
  assert.equal((await checkIdentities([rule])).ok, false);

  const feature = file("features/ruby_ore_scatter.json", {
    format_version: "1.13.0",
    "minecraft:scatter_feature": {
      description: { identifier: "codecraft:ruby_ore_scatter" },
    },
  });
  assert.equal((await checkIdentities([rule, feature])).ok, true);
});

test("A: vanilla feature doğrulanamaz ama sessizce geçmez", async () => {
  // features.json yapı feature'larını tutuyor, ore/scatter gibi yerleştirme
  // feature'larını değil. Bilinmeyen bir şeye "geçti" denmiyor: uyarı çıkıyor.
  const rule = file("feature_rules/ore.json", {
    format_version: "1.13.0",
    "minecraft:feature_rules": {
      description: { identifier: "codecraft:ore", places_feature: "minecraft:ore_diamond_feature" },
    },
  });

  const result = await checkIdentities([rule]);
  assert.equal(result.ok, true, "doğrulanamayan referans sonucu düşürmemeli");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.severity, "warning");
});

test("A: ayrıştırılamayan JSON sessizce atlanmıyor", async () => {
  const result = await checkIdentities([{ path: "blocks/x.json", content: "{,}" }]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.severity, "warning");
});

// --------------------------------------------------------------------------
// B · dosya adı kuralı
// --------------------------------------------------------------------------

test("B: feature rule dosya adı identifier ile eşleşmeli", async () => {
  // Oyunun verdiği hata: "Feature rule identifier 'ruby_ore_feature' does not
  // match filename 'ruby_ore'". Dosya adı düzeltilince kayboldu.
  const wrong = await fixture("feature-rules-ruby-ore.json", "feature_rules/ruby_ore.json");
  const result = checkFileNames([wrong]);

  assert.equal(result.ok, false, "yanlış dosya adı yakalanmalıydı");
  assert.ok(result.findings[0]?.message.includes("ruby_ore_feature.json"));

  const right = await fixture(
    "feature-rules-ruby-ore.json",
    "feature_rules/ruby_ore_feature.json",
  );
  assert.equal(checkFileNames([right]).ok, true);
});

test("B: kuralı olmayan dosya tipleri için bulgu üretilmiyor", async () => {
  // Kanıtı olmayan kural kodlanmıyor. Blok dosyasının adı identifier'dan
  // farklı ama bu oyunda ölçülmedi — uydurma bulgu çıkmamalı.
  const block = await fixture("block-ruby-ore.json", "blocks/bambaska_ad.json");
  assert.deepEqual(checkFileNames([block]).findings, []);
});

// --------------------------------------------------------------------------
// D · geçerli ama amaçlanmayan
// --------------------------------------------------------------------------

const WELCOME_WRONG = [
  'import { world } from "@minecraft/server";',
  "",
  "world.afterEvents.worldLoad.subscribe(() => {",
  '  world.sendMessage("Hos geldin!");',
  "});",
].join("\n");

const WELCOME_RIGHT = [
  'import { world } from "@minecraft/server";',
  "",
  "world.afterEvents.playerSpawn.subscribe((event) => {",
  "  if (!event.initialSpawn) return;",
  '  event.player.sendMessage("Hos geldin!");',
  "});",
].join("\n");

test("D: worldLoad içindeki sendMessage yakalanıyor", () => {
  const result = checkPatterns(WELCOME_WRONG, { path: "scripts/main.js" });
  assert.equal(result.ok, false, "worldLoad + sendMessage yakalanmalıydı");
  assert.equal(result.findings[0]?.check, "pattern:welcome-on-player-spawn");
  assert.equal(result.findings[0]?.path, "scripts/main.js");
});

test("D: doğru kalıp (playerSpawn) bulgu üretmiyor", () => {
  assert.deepEqual(checkPatterns(WELCOME_RIGHT).findings, []);
});

test("D: worldLoad'da sendMessage yoksa bulgu yok", () => {
  const code = [
    'import { world } from "@minecraft/server";',
    "world.afterEvents.worldLoad.subscribe(() => {",
    '  console.warn("yuklendi");',
    "});",
  ].join("\n");
  assert.deepEqual(checkPatterns(code).findings, []);
});

test("D: bilinmeyen kalıp adı sessizce atlanmıyor", () => {
  assert.throws(
    () => checkPatterns(WELCOME_WRONG, { only: ["uydurma-kalip"] }),
    /Unknown pattern/,
  );
  assert.ok(patternNames().includes("welcome-on-player-spawn"));
});
