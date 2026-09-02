/**
 * references.ts kümeleri — parçacık, ses, loot ve trade tablosu.
 *
 * Bu dosyanın en önemli testi ilki: eklenmeden ÖNCE ölçülmüş bir yanlış
 * pozitifi sabitliyor. `/particle minecraft:heart_particle` tamamen geçerli
 * bir vanilla komutu ve 02-09-2026'da `checkCommandIdentities`'ten
 * "1.26.40.5 sürümünde yok" diye **error** alıyordu — parçacıklar hiçbir
 * indekste yoktu. Yanlış pozitif bu depoda pahalı sayılıyor
 * (docs/VALIDATION-LIMITS.md C): aracın kendi hataları modele "bu aracın
 * hatalarını yok say" öğretiyor.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { lookupAny, referenceSet } from "@codecraft/knowledge";

import {
  checkCommandIdentities,
  checkReferences,
  checkSounds,
  type PackFile,
} from "../src/index.ts";

const file = (path: string, value: unknown): PackFile => ({
  path,
  content: JSON.stringify(value, null, 2),
});

// --------------------------------------------------------------------------
// Parçacıklar — ölçülmüş yanlış pozitifin kapanışı
// --------------------------------------------------------------------------

test("geçerli vanilla parçacığı komut metninde artık hata üretmiyor", async () => {
  const result = await checkCommandIdentities("particle minecraft:heart_particle ~ ~ ~");
  assert.deepEqual(result.findings, []);
});

test("kontrol grubu: uydurulmuş parçacık hâlâ yakalanıyor", async () => {
  // Düzeltme denetimi kapatmamalı — checkAssets'in atlas düzeltmesindeki
  // aynı kalıp (docs/VALIDATION-LIMITS.md C, "kontrol grubu").
  const result = await checkCommandIdentities("particle minecraft:uydurma_particle ~ ~ ~");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.severity, "error");
});

test("parçacık kimliği dosya adından türetilemiyor", async () => {
  // Kaynakta arrowspell.json -> minecraft:arrow_spell_emitter. Bu yüzden
  // 189 dosyanın hepsi okunuyor; ad kuralı yazmak kuralı uydurmak olurdu.
  const found = await lookupAny("minecraft:arrow_spell_emitter");
  assert.equal(found.found, true);
  assert.equal(found.kind, "particle");

  // Kontrol: dosya adı "arrowspell", kimlik ise bambaşka. Ad kuralı yazılsaydı
  // bu kimlik hiç bulunamazdı.
  const fromFilename = await lookupAny("minecraft:arrowspell");
  assert.equal(fromFilename.found, false);
});

// --------------------------------------------------------------------------
// Loot ve trade tablo YOLLARI — kimlik değil, dosya yolu
// --------------------------------------------------------------------------

const withLoot = (table: string): PackFile =>
  file("entities/test.json", {
    "minecraft:entity": {
      description: { identifier: "codecraft:test" },
      components: { "minecraft:loot": { table } },
    },
  });

test("var olan vanilla loot tablosu temiz geçer", async () => {
  const result = await checkReferences([withLoot("loot_tables/entities/cow.json")]);
  assert.deepEqual(result.findings, []);
});

test("olmayan loot tablosu yakalanır", async () => {
  const result = await checkReferences([withLoot("loot_tables/entities/yok.json")]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.check, "reference");
  // Yol raporlanmalı, yoksa hangi bileşende olduğu bulunamaz.
  assert.match(result.findings[0]?.message ?? "", /minecraft:loot\/table/);
});

test("paket kendi loot tablosunu getiriyorsa referans çözülür", async () => {
  // checkAssets'in 01-09-2026 dersi: doğru ve kurulabilir bir paketi "hatalı"
  // raporlamak yanlış pozitiftir.
  const result = await checkReferences([
    withLoot("loot_tables/entities/ruby_golem.json"),
    file("BP/loot_tables/entities/ruby_golem.json", { pools: [] }),
  ]);
  assert.deepEqual(result.findings, []);
});

test("kontrol grubu: paketin tablosu çıkarılınca bulgu geri gelir", async () => {
  const result = await checkReferences([withLoot("loot_tables/entities/ruby_golem.json")]);
  assert.equal(result.findings.length, 1);
});

test("takas tablosu da aynı kümeden doğrulanıyor", async () => {
  const vanilla = await referenceSet("tradeTables");
  const known = [...vanilla][0];
  assert.ok(known, "fixture varsayımı: en az bir vanilla takas tablosu olmalı");

  const good = await checkReferences([
    file("entities/t.json", { "minecraft:entity": { components: { "minecraft:trade_table": { table: known } } } }),
  ]);
  assert.deepEqual(good.findings, []);

  const bad = await checkReferences([
    file("entities/t.json", { "minecraft:entity": { components: { "minecraft:trade_table": { table: "trading/yok.json" } } } }),
  ]);
  assert.equal(bad.findings.length, 1);
});

test("hepsi warning — oyunda henüz ölçülmedi", async () => {
  const result = await checkReferences([withLoot("loot_tables/entities/yok.json")]);
  assert.equal(result.ok, true);
  assert.ok(result.findings.every((finding) => finding.severity === "warning"));
});

// --------------------------------------------------------------------------
// Ses olayları — kimlik regex'inin hiç göremediği yer
// --------------------------------------------------------------------------

test("geçerli ses olayı temiz geçer", async () => {
  const result = await checkSounds("playsound mob.cow.say @a");
  assert.deepEqual(result.findings, []);
});

test("yanlış yazılmış ses olayı yakalanır ve yakın ad önerilir", async () => {
  const result = await checkSounds("/playsound mob.cow.sayy @a");
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0]?.message ?? "", /mob\.cow\./);
});

test("playsound olmayan komutlar taranmıyor", async () => {
  const result = await checkSounds("give @a minecraft:stone 1\nsay merhaba");
  assert.deepEqual(result.findings, []);
});

test("tırnaklı ses adı da çözülüyor", async () => {
  const result = await checkSounds(`playsound "mob.cow.say" @a`);
  assert.deepEqual(result.findings, []);
});
