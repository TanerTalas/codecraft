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

test("JavaScript kuralları geçerli, gerçek API hatası hâlâ reddedilir", async () => {
  // İlk gerçek kapı koşusunun bulduğu kusur: doğrulayıcı oyunda çalışan bir
  // script'i yalnızca yardımcı fonksiyonun parametreleri tipsiz diye
  // düşürüyordu (TS7006). Bedrock düz JavaScript çalıştırıyor, orada bu
  // geçerli kod.
  const untyped = await validateScript(`
import { world } from "@minecraft/server";

function key(x, y, z) {
  return \`\${x},\${y},\${z}\`;
}

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { x, y, z } = event.block.location;
  console.log(key(x, y, z));
});
`);
  assert.equal(untyped.ok, true, untyped.errors.map((e) => e.message).join("; "));

  // Negatif kontrol: gevşetme yalnızca TS7006'yı kapsıyor. Gerçek bir API
  // hatası hâlâ düşmeli, yoksa doğrulayıcı işe yaramaz hâle gelirdi.
  const wrong = await validateScript(`
import { world } from "@minecraft/server";
world.afterEvents.playerBreakBlock.subscribe((event) => {
  event.block.uydurulmusMetot();
});
`);
  assert.equal(wrong.ok, false);
});

test("boş dizi never[] sayılmaz — JS'te geçerli, oyunda çalışıyor", async () => {
  // İkinci kapı koşusunun bulduğu kusur. `const x = []` TypeScript'te
  // never[] çıkarımı alıyor ve push() TS2345 veriyor; JavaScript'te any[].
  // Model tam olarak bu kalıbı üretti ve kod Bedrock'ta sorunsuz çalışır.
  const result = await validateScript(`
import { world } from "@minecraft/server";

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const found = [];
  found.push(event.block.location);
  for (const loc of found) {
    console.log(loc.x, loc.y, loc.z);
  }
});
`);
  assert.equal(result.ok, true, result.errors.map((e) => `${e.code}: ${e.message}`).join("; "));
});

test("uydurulmuş modül hâlâ reddedilir", async () => {
  // Gevşetmenin sınırını çizen negatif kontrol: JS olarak denetlemek
  // olmayan bir API'yi kabul etmeye dönüşmemeli.
  const result = await validateScript(`
import { world } from "@minecraft/server";
world.afterEvents.playerBreakBlock.subscribe((event) => {
  event.player.uydurulmusMetot();
});
`);
  assert.equal(result.ok, false);
});

test("çok satırlı tsc tanısı ayrıştırılır", async () => {
  // tsc ayrıntılı hataları iki satır basıyor: konum satırı, sonra girintili
  // açıklama. Ayrıştırıcı ikincisinde istisna fırlatıyordu ve bu CLI'ın ilk
  // gerçek koşusunu tamamen düşürdü — doğrulama sonucu bile üretilemedi.
  const result = await validateScript(`
import { world } from "@minecraft/server";
const flag = true;
world.afterEvents.playerSpawn.subscribe(() => {
  flag();
});
`);
  assert.equal(result.ok, false);
  // Açıklama satırı asıl bilgiyi taşıyor, mesaja eklenmeli.
  assert.match(result.errors.map((e) => e.message).join(" "), /no call signatures/i);
});
