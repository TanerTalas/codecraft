/**
 * Aşama 2: lookup ve sürüm çözümleme testleri.
 *
 * Gerçek data/ klasörüne karşı koşar — sahte veri kullanılmıyor. Pipeline
 * koşmamışsa testler patlar, ki doğrusu da bu: bu paketin tek işi o veriyi
 * doğru okumak.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  DATA_DIR,
  MARKERS,
  ROOT,
  blockStates,
  listDataVersions,
  lookup,
  normalizeId,
  resolveVersion,
} from "../src/index.ts";

test("sürüm çözümleme: istek verilmezse en yeni sürüm seçilir", async () => {
  const versions = await listDataVersions();
  assert.ok(versions.length > 0, "data/ içinde sürüm klasörü yok");
  const resolved = await resolveVersion();
  assert.equal(resolved.version, versions.at(-1));
  assert.equal(resolved.index.version, resolved.version);
});

test("sürüm çözümleme: üç parçalı istek dördüncü haneli klasöre eşleşir", async () => {
  const latest = (await listDataVersions()).at(-1) as string;
  const short = latest.split(".").slice(0, 3).join(".");
  const resolved = await resolveVersion(short);
  assert.equal(resolved.version, latest);
});

test("sürüm çözümleme: eksik hane önek sayılmaz", async () => {
  // 1.26.4 ile 1.26.40 farklı sürümler. Metin öneki eşleşse de kabul edilmemeli.
  const latest = (await listDataVersions()).at(-1) as string;
  const [major, minor, patch] = latest.split(".");
  const truncated = `${major}.${minor}.${(patch as string).slice(0, -1)}`;
  await assert.rejects(() => resolveVersion(truncated), /data\/ içinde yok/);
});

test("sürüm çözümleme: pazarlama numarası reddedilir", async () => {
  await assert.rejects(() => resolveVersion("26.40"), /Geçersiz sürüm biçimi/);
});

test("normalizeId namespace ekler, var olanı bozmaz", () => {
  assert.equal(normalizeId("stone"), "minecraft:stone");
  assert.equal(normalizeId("minecraft:stone"), "minecraft:stone");
  assert.equal(normalizeId("custom:ruby_block"), "custom:ruby_block");
});

test("lookup: var olan blok bulunur", async () => {
  const result = await lookup("minecraft:stone");
  assert.equal(result.found, true);
  assert.equal(result.kind, "block");
});

test("lookup: namespace'siz kimlik çözülür", async () => {
  const result = await lookup("stone");
  assert.equal(result.id, "minecraft:stone");
  assert.equal(result.found, true);
});

test("lookup: uydurulmuş kimlik bulunamaz", async () => {
  // Modellerin en sık ürettiği hata türü: var olmayan ama makul görünen kimlik.
  const result = await lookup("minecraft:ruby_block");
  assert.equal(result.found, false);
  assert.equal(result.kind, null);
});

test("lookup: tür ayrımı yapılır", async () => {
  const asEntity = await lookup("minecraft:stone", { kind: "entity" });
  assert.equal(asEntity.found, false);

  const creeper = await lookup("minecraft:creeper", { kind: "entity" });
  assert.equal(creeper.found, true);
  assert.equal(creeper.kind, "entity");
});

test("lookup: sadece item olan kimlik blok değildir", async () => {
  const stick = await lookup("minecraft:stick");
  assert.equal(stick.found, true);
  assert.equal(stick.kind, "item");
});

test("blockStates: durumlar ve alabildikleri değerler", async () => {
  const states = await blockStates("minecraft:acacia_button");
  assert.notEqual(states, null);
  assert.deepEqual(Object.keys(states as object).sort(), [
    "button_pressed_bit",
    "facing_direction",
  ]);
  assert.equal((states as Record<string, { type: string }>)["button_pressed_bit"]?.type, "bool");
});

test("blockStates: durumsuz blok boş nesne, olmayan blok null", async () => {
  assert.deepEqual(await blockStates("minecraft:stone"), {});
  assert.equal(await blockStates("minecraft:ruby_block"), null);
});

/**
 * Kök çözümü paketleyici yüzünden yukarı doğru aramaya döndü (paths.ts'teki
 * gerekçe). Arama sessizce yanlış bir dizine yerleşebilir; bu test onu
 * bağlıyor — işaretçilerin kendisini, MARKERS listesi üzerinden.
 */
test("ROOT gerçekten repo kökü: bütün işaretçiler orada", () => {
  for (const marker of MARKERS) {
    assert.ok(existsSync(join(ROOT, marker)), `${ROOT} altında ${marker} yok`);
  }
  assert.equal(DATA_DIR, join(ROOT, "data"));
});

test("CODECRAFT_ROOT verilmezse arama bu depoyu buluyor", async () => {
  // Sürüm klasörü ROOT üzerinden çözülüyor; yanlış kökte bu boş dönerdi.
  const versions = await listDataVersions();
  assert.ok(versions.length > 0, "data/ altında sürüm klasörü bulunamadı");
});
