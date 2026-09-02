/**
 * molang.ts — Molang sorgu ve fonksiyon adları.
 *
 * Her kontrolün iki yönü de ölçülür: doğru ifade temiz geçmeli, bozuk ifade
 * yakalanmalı. Sadece yeşil vermek bir kontrolün gerçekten baktığını
 * göstermez — `checks.test.ts` ve `json.test.ts` ile aynı kalıp.
 *
 * Bu dosyadaki beklentiler `data/<sürüm>/molang.json` üzerinden ölçülüyor,
 * elle yazılmış bir liste üzerinden değil. Kullanılan sorgular kaynakta
 * gerçekten var (02-09-2026: 315 sorgu, 61 matematik fonksiyonu, 6 kaldırılmış).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { molangIndex } from "@codecraft/knowledge";

import { checkMolang, scanMolang, validateMolang, type PackFile } from "../src/index.ts";

const file = (path: string, value: unknown): PackFile => ({
  path,
  content: JSON.stringify(value, null, 2),
});

// --------------------------------------------------------------------------
// Tarayıcı: neyi bulup neyi bulmadığı
// --------------------------------------------------------------------------

test("argümansız sorgu parantezsiz yazılır ve sıfır argüman sayılır", () => {
  const [call] = scanMolang("query.is_baby");
  assert.equal(call?.name, "is_baby");
  assert.equal(call?.args, 0);
});

test("takma ad çözülür — q. ile query. aynı kayda düşer", () => {
  const [call] = scanMolang("q.is_baby");
  assert.equal(call?.prefix, "q");
  assert.equal(call?.name, "is_baby");
});

test("büyük/küçük harf ayrımı yok", () => {
  // "All things in Molang are case-INsensitive" — doc_modules/molang.json.
  const [call] = scanMolang("Query.Is_Baby");
  assert.equal(call?.name, "is_baby");
});

test("argümanlar sayılır, iç içe parantez tek argüman bozmaz", () => {
  const [call] = scanMolang("math.clamp(math.abs(v.x), 0, 1)");
  assert.equal(call?.name, "clamp");
  assert.equal(call?.args, 3);
});

test("string içindeki virgül argüman saymıyor", () => {
  const [call] = scanMolang("query.is_item_equipped('main_hand,off_hand')");
  assert.equal(call?.args, 1);
});

test("faq.x, q. takma adı sanılmaz", () => {
  // \b olmasaydı "faq." içindeki q eşleşir ve uydurma bulgu üretirdi.
  assert.deepEqual(scanMolang("bkz faq.is_baby"), []);
});

test("kullanıcı tanımlı namespace'ler taranmıyor", () => {
  // variable/temp/context adları serbest, kapalı küme yok. Onlara
  // "bilinmiyor" demek uydurma hata olurdu.
  assert.deepEqual(scanMolang("variable.my_thing + t.x + c.y"), []);
});

test("kapanmamış parantezde argüman sayısı uydurulmaz", () => {
  assert.deepEqual(scanMolang("math.abs(1"), []);
});

// --------------------------------------------------------------------------
// Doğrulama: bilinen geçer, bilinmeyen yakalanır
// --------------------------------------------------------------------------

test("geçerli ifade temiz geçer", async () => {
  const result = await validateMolang(
    "math.cos(query.anim_time * 38) * variable.rotation_scale + q.life_time",
  );
  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
  // Kontrol: gerçekten üç çağrı görüldü, sessizce hiçbir şeye bakmadı değil.
  assert.equal(result.calls.length, 3);
});

test("uydurulmuş sorgu adı yakalanır ve yakın ad önerilir", async () => {
  const result = await validateMolang("query.is_babyy");
  assert.equal(result.ok, false);
  assert.equal(result.findings[0]?.kind, "unknown-query");
  assert.match(result.findings[0]?.message ?? "", /is_baby/);
});

test("uydurulmuş matematik fonksiyonu yakalanır", async () => {
  const result = await validateMolang("math.absolute(1)");
  assert.equal(result.findings[0]?.kind, "unknown-math");
});

test("kaldırılmış sorgu, kaldırıldığı sürümle birlikte raporlanır", async () => {
  // query.block_property 1.20.10'dan sonra kaldırılmış (molang.json, until).
  const index = await molangIndex();
  const entry = index.queries["block_property"];
  assert.ok(entry?.until, "fixture varsayımı: block_property kaldırılmış olmalı");

  const result = await validateMolang("query.block_property('x')");
  const removed = result.findings.find((finding) => finding.kind === "removed-query");
  assert.ok(removed, "kaldırılmış sorgu bulunmalı");
  assert.match(removed.message, new RegExp(entry.until));
});

test("eksik argüman yakalanır", async () => {
  // math.abs tam 1 argüman alır.
  const result = await validateMolang("math.abs()");
  assert.equal(result.findings[0]?.kind, "arity");
});

test("fazla argüman yakalanır", async () => {
  const result = await validateMolang("math.abs(1, 2)");
  assert.equal(result.findings[0]?.kind, "arity");
});

test("üst sınırı olmayan sorguya fazla argüman denmiyor", async () => {
  // 315 sorgunun 217'sinde max_args yok: üst sınır yok demek, min'e eşit değil.
  const index = await molangIndex();
  const open = Object.entries(index.queries).find(
    ([, entry]) => entry.max === undefined && entry.min === 0 && entry.until === undefined,
  );
  assert.ok(open, "fixture varsayımı: üst sınırsız bir sorgu olmalı");

  const result = await validateMolang(`query.${open[0]}(1, 2, 3)`);
  assert.equal(result.findings.length, 0);
});

// --------------------------------------------------------------------------
// Paket düzeyi: JSON stringlerinin içine bakılıyor
// --------------------------------------------------------------------------

test("JSON string içindeki bozuk Molang yakalanır", async () => {
  const controller = file("animation_controllers/test.json", {
    format_version: "1.10.0",
    animation_controllers: {
      "controller.animation.test": {
        states: { default: { transitions: [{ walk: "query.is_babyy" }] } },
      },
    },
  });

  const result = await checkMolang([controller]);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.check, "molang:unknown-query");
  assert.equal(result.findings[0]?.path, "animation_controllers/test.json");
  // Yol raporlanmalı, yoksa hangi alanda olduğu bulunamaz.
  assert.match(result.findings[0]?.message ?? "", /transitions/);
});

test("hepsi warning — ok'u düşürmüyor", async () => {
  // Bilinçli: bu sınıf gerçek oyunda henüz ölçülmedi ve veri sürümü kurulu
  // oyunun gerisinde kalabiliyor. Error'a yükseltmek bir ölçüm gerektirir.
  const result = await checkMolang([
    file("entities/x.json", { a: "query.is_babyy", b: "math.absolute(1)" }),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every((finding) => finding.severity === "warning"));
});

test("kontrol grubu: doğru yazılmış aynı paket temiz", async () => {
  // assets testindeki kalıp: düzeltme denetimi kapatmamalı, yalnızca
  // gerçekten yanlış olanı raporlamalı.
  const result = await checkMolang([
    file("entities/x.json", { a: "query.is_baby", b: "math.abs(1)" }),
  ]);
  assert.deepEqual(result.findings, []);
});

test("Molang içermeyen JSON hiç bulgu üretmiyor", async () => {
  const result = await checkMolang([
    file("blocks/ruby.json", {
      format_version: "1.21.100",
      "minecraft:block": { description: { identifier: "codecraft:ruby" } },
    }),
  ]);
  assert.deepEqual(result.findings, []);
});
