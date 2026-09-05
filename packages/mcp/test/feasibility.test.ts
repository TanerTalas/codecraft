/**
 * Yapılabilirlik tablosunun testi.
 *
 * Asıl değerli kısmı ikinci blok: kuralların dayandığı API YOKLUĞU gerçekten
 * ölçülüyor. Mojang bir gün SimulatedPlayer'ı @minecraft/server'a taşırsa bu
 * test kırmızıya döner ve kural yeniden ölçülür — "muhtemelen hâlâ yoktur"
 * diye devam edilmez.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveVersion } from "@codecraft/knowledge";

import { ABSENT_APIS, checkFeasibility, feasibilityRules } from "../src/bedrock/feasibility.ts";

test("girdi simülasyonu isteği yakalanır ve alternatif önerilir", () => {
  const result = checkFeasibility("Fareme basılı tutmuş gibi otomatik kazsın");
  assert.equal(result.blocked, true);
  if (!result.blocked) return;
  assert.equal(result.category, "input-simulation");
  assert.match(result.alternative, /chain mining|neighbouring/i);
});

test("dosya sistemi isteği yakalanır", () => {
  const result = checkFeasibility("Dünyamı her akşam otomatik yedeklesin");
  assert.equal(result.blocked, true);
  if (!result.blocked) return;
  assert.equal(result.category, "filesystem");
});

test("ağ isteği yakalanır", () => {
  const result = checkFeasibility("Ölünce discord'a mesaj atsın");
  assert.equal(result.blocked, true);
  if (!result.blocked) return;
  assert.equal(result.category, "network");
});

test("yapılabilir istekler engellenmez", () => {
  // Yanlış pozitif en pahalı hata: yapılabilir bir şeye "yapılamaz" demek.
  for (const request of [
    "Kırdığım bloğun aynı türden komşularını da kırsın",
    "Öldüğüm yerin koordinatlarını bana yazsın",
    "Yakut cevheri diye yeni bir blok ekle",
    "Her otuz saniyede bir yanımda bir zombi belirsin",
    "Bir kişi yatağa girince gece geçsin",
  ]) {
    assert.equal(checkFeasibility(request).blocked, false, request);
  }
});

test("her kuralın kanıtı ve alternatifi var", () => {
  for (const rule of feasibilityRules()) {
    assert.ok(rule.evidence.length > 0, `${rule.category}: kanıt yok`);
    assert.ok(rule.alternative.length > 0, `${rule.category}: alternatif yok`);
    assert.ok(rule.triggers.length > 0, `${rule.category}: tetikleyici yok`);
  }
});

test("kuralların dayandığı API'ler tip tanımlarında gerçekten yok", async () => {
  const { dir, index } = await resolveVersion();
  const release = index.sources.scriptTypes.modules["@minecraft/server"]?.stable;
  assert.ok(release !== undefined && release !== null, "@minecraft/server kaydı yok");

  const types = await readFile(
    join(dir, index.sources.scriptTypes.path, "@minecraft/server", release, "index.d.ts"),
    "utf8",
  );

  for (const [category, names] of Object.entries(ABSENT_APIS)) {
    for (const name of names) {
      assert.ok(
        !new RegExp(`\b${name}\b`).test(types),
        `${category}: "${name}" artık @minecraft/server ${release} içinde var — ` +
          "yapılabilirlik kuralı yeniden ölçülmeli",
      );
    }
  }
});

test("fetch yalnızca doküman yorumunda geçiyor, API olarak tanımlı değil", async () => {
  const { dir, index } = await resolveVersion();
  const release = index.sources.scriptTypes.modules["@minecraft/server"]?.stable as string;
  const types = await readFile(
    join(dir, index.sources.scriptTypes.path, "@minecraft/server", release, "index.d.ts"),
    "utf8",
  );

  // "fetched from" gibi yorumlar sayılmaz; aranan şey bir bildirim.
  const declarations = types
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("*") && /\bfetch\s*[(<:]/.test(line));
  assert.deepEqual(declarations, []);
});

/**
 * Girdinin YOKLUĞU üzerinden kurulan istek.
 *
 * Ölçüldü 01-09-2026 (docs/mcp-kullanim.md, senaryo 4): bu istek gerçek bir
 * oturumda MCP üzerinden soruldu, check_feasibility "blocked: false" döndü ve
 * modeli durduran şey araç DEĞİL kendi bilgisi oldu. Doğru cevap oyunun
 * dışından çalışan bir script'ti ve araç bunu söylemiyordu.
 *
 * Tetikleyici listesi bir regex listesi, yani doğası gereği eksik kalabilir.
 * Bu testin işi kapsamı genişletmek değil, ÖLÇÜLEN kaybı sabitlemek.
 */
test("girdinin yokluğu üzerinden kurulan istek de yakalanır", () => {
  const result = checkFeasibility("Ben klavyeye dokunmadan otomatik balık tutsun");
  assert.equal(result.blocked, true);
  assert.equal(result.blocked && result.category, "input-simulation");

  for (const request of [
    "Tuşa basmadan ağaç kessin",
    "Fareye değmeden madencilik yapsın",
  ]) {
    assert.equal(checkFeasibility(request).blocked, true, request);
  }
});

test("genişletme yapılabilir istekleri engellemiyor", () => {
  // Tetikleyici genişletilirken "otomatik <şey>" kalıbı BİLEREK alınmadı:
  // aşağıdakilerin hepsi tamamen yapılabilir ve yanlış engellenirlerdi.
  // Eval korpusunun 22 python olmayan vakasının tamamında ölçüldü, yanlış
  // engelleme sıfır; buraya en riskli olanlar alındı.
  for (const request of [
    "Yakut cevheri yer altında doğal olarak oluşsun",
    "Her otuz saniyede bir yanımda bir zombi belirsin",
    "Elma yediğimde canım tamamen dolsun",
    "Kırdığım bloğun aynı türden komşularını da kırsın",
    "Etrafıma on çarpı on camdan bir kutu yap",
  ]) {
    assert.equal(checkFeasibility(request).blocked, false, request);
  }
});

/**
 * "otomatik" ile fiil arasına kelime giren istek.
 *
 * Ölçüldü 05-09-2026 (docs/mcp-kullanim.md): kullanıcının kendi cümlesi MCP
 * ucundan geçirildi ve check_feasibility `blocked: false` döndü. İlgili üç
 * tetikleyici tek tek koşuldu, üçü de eşleşmedi; sebebi /otomatik\s*(fiil)/
 * kalıbının fiili BİTİŞİK araması, cümlede araya "olarak o bloğu" girmesi.
 * Senaryo 4 ile aynı sınıfta üçüncü vaka.
 *
 * Bu testin işi kapsamı genişletmek değil, ÖLÇÜLEN kaybı sabitlemek —
 * senaryo 4 testinin yanındaki not aynen geçerli.
 */
test("otomatik ile fiil arasına kelime giren istek de yakalanır", () => {
  const result = checkFeasibility(
    "Crosshair toprak, çim veya taş bloğun üstündeyken otomatik olarak o bloğu " +
      "kırmaya başlasın. Hilelerin kapalı olduğu tek kişilik dünyada kullanacağım.",
  );
  assert.equal(result.blocked, true);
  assert.equal(result.blocked && result.category, "input-simulation");

  for (const request of [
    "Otomatik olarak taşı kazsın",
    "Otomatik olarak ağaç kessin",
    "automatically break the block I am looking at",
    "automatically start mining the stone in front of me",
    "I want an auto miner",
  ]) {
    assert.equal(checkFeasibility(request).blocked, true, request);
  }
});

test("aradaki boşluğa izin vermek yapılabilir istekleri engellemiyor", () => {
  // Bu liste yukarıdaki genişletmenin fiyatı. Fiil köküne çekim eki şartı
  // ÖLÇÜLEREK kondu: eksiz hâlde "kazan", "kesin", "kırmızı" ve "vurgu"
  // kelimeleri kök olarak eşleşiyor ve dördü de yanlış engelleniyordu.
  for (const request of [
    "Otomatik olarak kapı açılsın",
    "Yakut cevheri otomatik olarak yer altında oluşsun",
    "Otomatik olarak her gece bir zombi belirsin",
    "Otomatik olarak kazan suyla dolsun",
    "Otomatik olarak kazandığım puanı ekranda göster",
    "Otomatik olarak kırmızı yün bloğu versin",
    "Otomatik olarak kesin bir sayı göster",
    "Otomatik olarak vurgu rengini değiştir",
    "spawn a zombie automatically every thirty seconds",
    "the door should open automatically",
    "automatically fill the cauldron with water",
    "build an automatic farm",
  ]) {
    assert.equal(checkFeasibility(request).blocked, false, request);
  }
});
