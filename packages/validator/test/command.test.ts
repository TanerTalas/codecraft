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

import {
  CHECKED_TYPES,
  loadCommandIndex,
  parseBlockStates,
  SELECTOR_LETTERS,
  tokenize,
  validateCommand,
} from "../src/command.ts";

const VERSION = "1.26.40";
const check = (line: string) => validateCommand(line, { version: VERSION });

test("geçerli komutlar geçer", async () => {
  for (const line of [
    "/give @s minecraft:diamond 64",
    "/give @s minecraft:diamond",
    "/fill ~-5 ~ ~-5 ~5 ~3 ~5 minecraft:glass hollow",
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

test("seçici harfleri oyundan ölçülen listeye göre doğrulanıyor", async () => {
  // Liste elle yazılmadı: npm run ws:probe ile oyuna soruldu (30-08-2026).
  // Altısı kabul edildi, @z/@x/@q "Syntax error: Unexpected" ile reddedildi.
  for (const letter of SELECTOR_LETTERS) {
    const result = await check(`/testfor @${letter}`);
    assert.equal(result.ok, true, `@${letter} reddedildi`);
  }
  for (const letter of ["z", "x", "q"]) {
    const result = await check(`/testfor @${letter}`);
    assert.equal(result.ok, false, `@${letter} kabul edildi`);
  }
});

test("oyuncu adı seçici yerine kullanılabilir", async () => {
  // Seçici olmayan düz bir ad geçerli bir hedef.
  const result = await check("/testfor Lyliahh");
  assert.equal(result.ok, true, result.errors[0]?.message ?? "");
});

// --------------------------------------------------------------------------
// Blok durumları
// --------------------------------------------------------------------------

test("blok durumu ayrıştırma", () => {
  assert.deepEqual(parseBlockStates('["open_bit"=true]'), [{ key: "open_bit", value: "true" }]);
  assert.deepEqual(parseBlockStates("[]"), []);
  assert.deepEqual(parseBlockStates('["a"=1,"b"="x"]'), [
    { key: "a", value: "1" },
    { key: "b", value: "x" },
  ]);
  // Biçim tanınmazsa null: çağıran "ayrıştıramadım" der, hata uydurmaz.
  assert.equal(parseBlockStates("acik"), null);
  assert.equal(parseBlockStates('["esitlik yok"]'), null);
});

test("geçerli blok durumları geçer", async () => {
  for (const line of [
    '/setblock ~ ~ ~ minecraft:acacia_button ["facing_direction"=3]',
    '/setblock ~ ~ ~ minecraft:acacia_door ["open_bit"=true]',
    '/setblock ~ ~ ~ minecraft:acacia_door ["minecraft:cardinal_direction"="north"]',
    "/setblock ~ ~ ~ minecraft:stone []",
  ]) {
    const result = await check(line);
    assert.equal(result.ok, true, `${line} → ${result.errors[0]?.message ?? ""}`);
  }
});

test("uydurulmuş durum adı yakalanır", async () => {
  const result = await check('/setblock ~ ~ ~ minecraft:acacia_button ["uydurma_durum"=1]');
  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message ?? "", /durumu değil/);
});

test("aralık dışı durum değeri yakalanır", async () => {
  // facing_direction 0..5; 99 kabul edilmemeli.
  const result = await check('/setblock ~ ~ ~ minecraft:acacia_button ["facing_direction"=99]');
  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message ?? "", /geçerli değil/);
});

test("paketin kendi kimlikleri reddedilmez", async () => {
  // Yanlış pozitif en pahalı hata: kullanıcının kendi bloğu "geçersiz"
  // görünüyordu. Komut grameri eklenti kimliğini bilemez; var olup olmadığı
  // checkCommandIdentities'in ayrı ekseni.
  for (const line of [
    "/setblock ~ ~ ~ codecraft:ruby_ore",
    "/give @s codecraft:ruby 1",
    "/summon codecraft:guard ~ ~ ~",
  ]) {
    const result = await check(line);
    assert.equal(result.ok, true, `${line} → ${result.errors[0]?.message ?? ""}`);
  }
});

test("uydurulmuş vanilla kimliği hâlâ reddedilir", async () => {
  // Gevşetmenin sınırı: minecraft: namespace'i indeksten kesin doğrulanıyor.
  const result = await check("/setblock ~ ~ ~ minecraft:uydurma_blok");
  assert.equal(result.ok, false);
});

test("eski veri değeri biçimi KABUL edilir — oyunda ölçüldü", async () => {
  // Mojang'ın yayımladığı tanımda bu biçim YOK: hiçbir fill aşırı yüklemesi
  // blok adından sonra INT almıyor. Doğrulayıcı bu yüzden önce reddediyordu
  // ve elle yazılmış bir eval fixture'ını "hatalı" sanıp değiştirdim.
  //
  // Oyun tersini söyledi (30-08-2026, npm run ws:probe):
  //
  //   fill ... minecraft:air 0 replace       ayrıştı        (-2147352576)
  //   fill ... minecraft:air BOGUS replace   sözdizimi hatası (-2147483648)
  //
  // Kontrol grubu belirleyici: sayı ayrışıyor, saçma değer ayrışmıyor. Gerçek
  // ayrıştırıcı geriye dönük uyumluluğu koruyor, yayımlanan tanım anlatmıyor.
  // Yayımlanan tanım tek başına yeterli değil; ölçüm onun üstünde.
  const legacy = await check("/fill ~-5 ~ ~-5 ~5 ~4 ~5 minecraft:glass 0 hollow");
  assert.equal(legacy.ok, true, legacy.errors[0]?.message ?? "");

  const modern = await check("/fill ~-5 ~ ~-5 ~5 ~4 ~5 minecraft:glass hollow");
  assert.equal(modern.ok, true, modern.errors[0]?.message ?? "");

  // Sınır: gevşetme yalnızca tam sayıyı kapsıyor, her şeyi değil.
  const bogus = await check("/fill ~-5 ~ ~-5 ~5 ~4 ~5 minecraft:glass BOGUS hollow");
  assert.equal(bogus.ok, false);
});
