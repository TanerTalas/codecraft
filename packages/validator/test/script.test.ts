/**
 * validateScript testleri.
 *
 * Gömülü kod parçalarıyla koşar: script fixture'ları JSON'dan yavaş yazılıyor
 * ve her biri gerçek @minecraft/server API'si kullanmak zorunda, o yüzden
 * bitiş kriterindeki 20 fixture JSON'a ayrıldı (bkz. fixtures/cases.json).
 *
 * tsc her çağrıda bir süreç başlatıyor — bu dosya JSON testlerinden yavaş.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { validateScript } from "../src/index.ts";

test("geçerli script hatasız derlenir", async () => {
  const result = await validateScript(`
import { world } from "@minecraft/server";

world.afterEvents.playerBreakBlock.subscribe((event) => {
  console.warn(\`\${event.player.name} bir blok kırdı\`);
});
`);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.modules["@minecraft/server"], "2.9.0");
});

test("1.x'te kalmış API reddedilir", async () => {
  // Genel modellerin en sık ürettiği hata: runCommandAsync 2.x'te kaldırıldı.
  const result = await validateScript(`
import { world } from "@minecraft/server";
world.getDimension("overworld").runCommandAsync("say merhaba");
`);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "TS2551");
  assert.match(result.errors[0]?.message ?? "", /runCommandAsync/);
});

test("hata satırı kullanıcının kodundaki satırla eşleşir", async () => {
  const result = await validateScript(
    ['import { world } from "@minecraft/server";', "", "world.uydurmaAlan;"].join("\n"),
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.line, 3);
});

test("olmayan modül reddedilir", async () => {
  const result = await validateScript(`import { world } from "@minecraft/server-api";\nworld;`);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "TS2307");
});

test("gerçek imzada tip hatası yakalanır", async () => {
  const result = await validateScript(`
import { world } from "@minecraft/server";
const dimension = world.getDimension("overworld");
dimension.spawnEntity("minecraft:creeper", "0 64 0");
`);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("@minecraft/server-ui de çözümleniyor", async () => {
  const result = await validateScript(`
import { ActionFormData } from "@minecraft/server-ui";
import { world } from "@minecraft/server";

const form = new ActionFormData().title("Menü").button("Kapat");
for (const player of world.getAllPlayers()) {
  void form.show(player);
}
`);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("beta kanalı beta modül sürümlerine karşı derler", async () => {
  const result = await validateScript(`import { world } from "@minecraft/server";\nvoid world;`, {
    channel: "beta",
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.modules["@minecraft/server"], "2.10.0-beta");
  // @minecraft/common'ın betası yok, kararlıya düşer.
  assert.equal(result.modules["@minecraft/common"], "1.3.0");
});

test("tarayıcı API'si Bedrock'ta yok, reddedilir", async () => {
  // lib: ["DOM"] eklenmediğinin kanıtı. Eklenseydi fetch geçerdi ve araç
  // uydurulmuş API üreten modelleri yakalayamazdı.
  const result = await validateScript(`void fetch("https://example.com");`);
  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message ?? "", /fetch/);
});

test("console kabul edilir", async () => {
  // Hiçbir .d.ts console tanımlamıyor ama Mojang kendi JSDoc örneklerinde
  // kullanıyor; ambient tanım olmadan geçerli script'ler reddedilirdi.
  const result = await validateScript(`console.log("a"); console.warn("b"); console.error("c");`);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});
