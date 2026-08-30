/**
 * Komut metnindeki kimlik kontrolü.
 *
 * Ölçülen şey dar ve kasıtlı: kimlik var mı. Komut SÖZDİZİMİ doğrulanmıyor —
 * Bedrock komut grameri için makine okunur resmi kaynak yok ve sözdizimi
 * doğrulayıcısı v1 kapsamı dışında (CLAUDE.md). Bu, var olan kontrolün komut
 * metnine uygulanması.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkCommandIdentities } from "../src/checks.ts";

const VERSION = "1.26.40";

test("geçerli vanilla kimliği geçer", async () => {
  const result = await checkCommandIdentities("/give @s minecraft:diamond 64", {
    version: VERSION,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test("uydurulmuş vanilla kimliği yakalanır", async () => {
  const result = await checkCommandIdentities("/give @s minecraft:ruby 64", {
    version: VERSION,
  });
  assert.equal(result.ok, false);
  assert.equal(result.findings[0]?.check, "commandIdentity");
  assert.match(result.findings[0]?.message ?? "", /minecraft:ruby/);
});

test("blok ve item dışı kimlikler de tanınır", async () => {
  // Dar arama (blok/item/entity) bunlara uydurma "yok" hatası verirdi.
  for (const command of [
    "/effect @s minecraft:speed 30 1",
    "/execute in minecraft:overworld run say merhaba",
    "/enchant @s minecraft:sharpness 3",
  ]) {
    const result = await checkCommandIdentities(command, { version: VERSION });
    assert.equal(result.ok, true, `${command}: ${result.findings[0]?.message ?? ""}`);
  }
});

test("özel namespace komuttan doğrulanamaz, uyarı üretir", async () => {
  const result = await checkCommandIdentities("/give @s codecraft:ruby 1", {
    version: VERSION,
  });
  // Uyarı düşürmez: bilinmeyene "geçti" denmiyor ama uydurma hata da yok.
  assert.equal(result.ok, true);
  assert.equal(result.findings[0]?.severity, "warning");
});

test("pakette tanımlıysa özel namespace uyarı üretmez", async () => {
  const result = await checkCommandIdentities("/give @s codecraft:ruby 1", {
    version: VERSION,
    declared: ["codecraft:ruby"],
  });
  assert.deepEqual(result.findings, []);
});

test("aynı kimlik iki kez raporlanmaz", async () => {
  const result = await checkCommandIdentities(
    "/give @s minecraft:ruby 1\n/give @s minecraft:ruby 2",
    { version: VERSION },
  );
  assert.equal(result.findings.length, 1);
});

test("selector ve sayılar kimlik sanılmaz", async () => {
  const result = await checkCommandIdentities(
    "/fill ~-5 ~ ~-5 ~5 ~3 ~5 minecraft:glass 0 hollow",
    { version: VERSION },
  );
  assert.equal(result.ok, true);
});
