/**
 * Python otomasyon script'i doğrulaması (02-09-2026).
 *
 * Üç eksen ayrı ayrı ölçülüyor. Tek bir "ok=false" görmek hangi eksenin
 * düştüğünü söylemiyor; her testte bulgunun `kind`'ı da assert ediliyor.
 *
 * Sözdizimi ayağı gerçek bir Python yorumlayıcısı istiyor. Yoksa test o ayağı
 * ATLAR ama diğerlerini koşturur — ve atladığını söyler. Yeşil görünen ama
 * hiçbir şey ölçmeyen test, bu depoda bir kez yapılmış bir hata.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { pythonRuntimeReport, validatePython } from "../src/index.ts";

const VERSION = "1.26.40";
const check = (code: string) => validatePython(code, { version: VERSION });

/** Sözdizimi ayağı bu makinede koşabiliyor mu. */
const hasPython = (await pythonRuntimeReport())["python"]?.ok === true;

const GOOD = `import json, asyncio, websockets

async def main():
    async with websockets.connect("ws://localhost:19131") as ws:
        await ws.send(json.dumps({
            "header": {"version": 1, "requestId": "abc", "messageType": "commandRequest",
                       "messagePurpose": "subscribe"},
            "body": {"eventName": "BlockBroken"}}))
        await ws.send(json.dumps({"commandLine": "/say merhaba"}))
`;

test("geçerli script üç eksenden de temiz geçiyor", async () => {
  const result = await check(GOOD);
  assert.equal(result.ok, true, `bulgular: ${JSON.stringify(result.findings)}`);
  // Komut gerçekten görüldü mü — sıfır olsaydı "temiz" hiçbir şey ölçmemek olurdu.
  assert.equal(result.commandsChecked, 1);
});

test("gömülü komut doğrulanıyor: eski veri değeri reddediliyor", async () => {
  // Bu tam olarak M5'te OYUNDA yakalanan hata: doğrulayıcı "glass 0 outline"
  // biçimini kabul ediyordu, sohbet etmiyordu ve kullanıcıya çalışmayan bir
  // komut gitti (docs/COMMANDS.md, kanal farkı). Python gövdesindeki komut o
  // gün hiçbir doğrulayıcıdan geçmiyordu.
  const result = await check('cmd = "/fill ~-5 ~-1 ~-5 ~5 ~9 ~5 glass 0 outline"\n');
  assert.equal(result.ok, false);
  assert.equal(result.commandsChecked, 1);
  assert.equal(result.findings[0]?.kind, "command");
  assert.equal(result.findings[0]?.line, 1);
});

test("olmayan komut yakalanıyor", async () => {
  const result = await check('run("/uydurmakomut 1 2")\n');
  assert.equal(result.ok, false);
  assert.equal(result.findings[0]?.kind, "command");
});

test("eğik çizgisiz dize komut sanılmıyor", async () => {
  // Kapsam bilerek dar: "say" tek başına bir komut değil, sıradan bir dize.
  // Komut sayılsaydı arity hatası üretirdi — yanlış pozitif.
  const result = await check('mode = "say"\nname = "list"\n');
  assert.equal(result.commandsChecked, 0);
  assert.equal(result.ok, true, `bulgular: ${JSON.stringify(result.findings)}`);
});

test("gelen tarafın messagePurpose'u gönderilen zarfta yakalanıyor", async () => {
  const result = await check('envelope = {"messagePurpose": "event"}\n');
  assert.equal(result.ok, false);
  assert.equal(result.findings[0]?.kind, "protocol");
  assert.match(result.findings[0]?.message ?? "", /GELEN/);
});

test("ölçülmemiş messagePurpose bildiriliyor", async () => {
  const result = await check('e = {"messagePurpose": "uydurmaAmac"}\n');
  assert.equal(result.ok, false);
  assert.equal(result.findings[0]?.kind, "protocol");
});

test("ölçülmüş messagePurpose değerleri kabul ediliyor", async () => {
  for (const purpose of ["subscribe", "unsubscribe", "commandRequest"]) {
    const result = await check(`e = {"messagePurpose": "${purpose}"}\n`);
    assert.equal(result.ok, true, `${purpose} reddedildi`);
  }
});

test("sözdizimi hatası satır numarasıyla yakalanıyor", { skip: !hasPython }, async () => {
  const result = await check("import json\ndef main(\n    print('x')\n");
  assert.equal(result.syntaxChecked, true);
  assert.equal(result.ok, false);
  const syntax = result.findings.find((finding) => finding.kind === "syntax");
  assert.ok(syntax, `sözdizimi bulgusu yok: ${JSON.stringify(result.findings)}`);
  assert.equal(syntax.line, 2);
});

test("sözdizimi bakılamadıysa ok sessizce true dönmüyor", async () => {
  // syntaxChecked ile ok AYRI iki alan. Python yoksa ok true olabilir ama
  // syntaxChecked false kalır ve syntaxSkipped sebebi taşır — çağıran ikisine
  // birden bakmak zorunda. "Bakılamadı" ile "doğru" karıştırılmıyor.
  const result = await check("x = 1\n");
  if (result.syntaxChecked) {
    assert.equal(result.syntaxSkipped, null);
  } else {
    assert.ok(result.syntaxSkipped, "atlandı ama sebebi yazılmamış");
    assert.match(result.syntaxSkipped, /Python/);
  }
});

test("pythonRuntimeReport ön koşulu ayrı ayrı ölçüyor", async () => {
  const report = await pythonRuntimeReport();
  assert.ok(report["python"], "python kontrolü yok");
  assert.equal(typeof report["python"].ok, "boolean");
  assert.equal(typeof report["python"].ms, "number");
  if (report["python"].ok) {
    assert.ok(report["compile"]?.ok, "geçerli kaynak reddedildi");
    assert.match(report["python"].detail, /Python/i);
  }
});
