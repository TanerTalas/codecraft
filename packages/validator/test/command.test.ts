/**
 * Komut sözdizimi doğrulaması.
 *
 * İki yön de ölçülüyor ve ikisi de zorunlu:
 *
 *   Geçerli komutlar geçmeli   — yanlış pozitif en pahalı hata. Çalışan bir
 *                                komuta "bozuk" demek, bozuğu kaçırmaktan
 *                                kötü: kullanıcı araca güvenmeyi bırakır.
 *   Bozuk komutlar düşmeli     — yoksa doğrulayıcı süs olur.
 *
 * Üçüncü bir test kapsamın nerede bittiğini kayda geçiriyor: hangi yapısal
 * tipler gerçekten denetleniyor, hangileri kabul edilip geçiliyor.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { CHECKED_TYPES, loadCommandIndex, tokenize, validateCommand } from "../src/command.ts";

const VERSION = "1.26.40";
const check = (line: string) => validateCommand(line, { version: VERSION });

test("geçerli komutlar geçer", async () => {
  for (const line of [
    "/give @s minecraft:diamond 64",
    "/give @s minecraft:diamond",
    "/fill ~-5 ~ ~-5 ~5 ~3 ~5 minecraft:glass 0 hollow",
    "/setblock ~ ~1 ~ minecraft:stone",
    "/effect @s minecraft:speed 30 1",
    "/effect @s speed 30 1",
    "/summon minecraft:zombie ~ ~ ~",
    "/time set day",
    "/gamemode creative @s",
    "/say merhaba dunya nasilsin",
    "/tp @s 100 64 100",
    "/kill @e[type=zombie]",
  ]) {
    const result = await check(line);
    assert.equal(result.ok, true, `${line} → ${result.errors[0]?.message ?? ""}`);
  }
});

test("baştaki eğik çizgi zorunlu değil", async () => {
  const withSlash = await check("/time set day");
  const without = await check("time set day");
  assert.equal(withSlash.ok, true);
  assert.equal(without.ok, true);
});

test("alias çözülüyor", async () => {
  // "tp" kaynakta ayrı bir komut değil, teleport'un alias'ı. Ham veride
  // alias'lar nesne dizisi ({ "name": "tp" }), düz metin değil.
  const result = await check("/tp @s 10 20 30");
  assert.equal(result.ok, true, result.errors[0]?.message ?? "");
  assert.equal(result.command, "teleport");
});

test("olmayan komut yakalanır", async () => {
  const result = await check("/uydurulmuskomut @s");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.kind, "unknown-command");
});

test("eksik argüman yakalanır", async () => {
  const result = await check("/give");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.kind, "arity");
});

test("fazladan argüman yakalanır", async () => {
  const result = await check("/time set day fazladan");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.kind, "arity");
});

test("enum dışı değer yakalanır ve kabul edilenler gösterilir", async () => {
  const result = await check("/gamemode uydurma");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.kind, "argument");
  assert.match(result.errors[0]?.message ?? "", /creative|survival|adventure/);
});

test("eksik koordinat bileşeni yakalanır", async () => {
  // POSITION üç token tüketiyor; iki tane verilince düşmeli.
  const result = await check("/setblock ~ ~1 minecraft:stone");
  assert.equal(result.ok, false);
});

test("hiçbir kullanım uymayınca biçimler gösterilir", async () => {
  // effect'in üç aşırı yüklemesi var ve "en yakın aday" beraberliğe düşüyor;
  // tek bir hata mesajı yanıltıcı olabilir, o yüzden hepsi listeleniyor.
  const result = await check("/effect @s uydurulmus_efekt 30 1");
  assert.equal(result.ok, false);
  assert.ok(result.usage.length >= 2, "kullanım biçimleri boş");
  assert.ok(result.usage.some((line) => line.includes("EFFECT")));
});

test("geçen komutta kullanım listesi boş", async () => {
  const result = await check("/time set day");
  assert.deepEqual(result.usage, []);
});

test("hile gerektiren komut işaretleniyor", async () => {
  const give = await check("/give @s minecraft:diamond");
  assert.equal(give.requiresCheats, true);
});

test("boş girdi sessizce geçmez", async () => {
  const result = await check("   ");
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.kind, "syntax");
});

// --------------------------------------------------------------------------
// Sözcükleme
// --------------------------------------------------------------------------

test("seçici, JSON ve tırnak tek parça kalır", () => {
  assert.deepEqual(tokenize("kill @e[type=zombie,r=5]"), ["kill", "@e[type=zombie,r=5]"]);
  assert.deepEqual(tokenize('tellraw @s {"rawtext":[{"text":"a b"}]}'), [
    "tellraw",
    "@s",
    '{"rawtext":[{"text":"a b"}]}',
  ]);
  assert.deepEqual(tokenize('say "iki kelime" tek'), ["say", '"iki kelime"', "tek"]);
});

test("tırnak içindeki parantez dengeyi bozmaz", () => {
  assert.deepEqual(tokenize('say "a]b" c'), ["say", '"a]b"', "c"]);
});

// --------------------------------------------------------------------------
// Kapsam
// --------------------------------------------------------------------------

test("denetlenmeyen yapısal tipler kayıt altında", async () => {
  const index = await loadCommandIndex(VERSION);

  const structural = new Set<string>();
  for (const command of Object.values(index.commands)) {
    for (const overload of command.overloads) {
      for (const param of overload.params) {
        if (index.enums[param.type.toLowerCase()] === undefined) structural.add(param.type);
      }
    }
  }

  const unchecked = [...structural].filter((type) => !CHECKED_TYPES.has(type)).sort();

  // Kapsam gizlenmiyor, sabitleniyor. Bu liste küçüldükçe test güncellenir;
  // Mojang yeni bir yapısal tip eklerse burada görünür ve kararı zorlar.
  assert.deepEqual(unchecked, [
    "BLOCK_STATE_ARRAY",
    "CODEBUILDERARGS",
    "EXECUTECHAINEDOPTION_0",
    "ID",
    "JSON_OBJECT",
    "MESSAGE_ROOT",
    "PATHCOMMAND",
    "RAWTEXT",
    "RVAL",
    "VAL",
  ]);

  // Enum tarafı kesin doğrulanıyor ve büyük çoğunluğu o oluşturuyor.
  assert.ok(Object.keys(index.enums).length > 200);
});

test("seçici harfi henüz doğrulanmıyor — bilinen boşluk", async () => {
  // @z geçerli bir seçici değil ama geçerli harflerin listesi Mojang'ın
  // makine okunur tanımında yok. Elle liste yazmak bu projenin kaçındığı şey;
  // ölçülene kadar kabul ediliyor ve boşluk burada kayıtlı.
  const result = await check("/give @z minecraft:diamond 1");
  assert.equal(result.ok, true);
});
