/**
 * Yapılabilirlik tablosunun testi.
 *
 * Asıl değerli kısmı ikinci blok: kuralların dayandığı API YOKLUĞU gerçekten
 * ölçülüyor. Mojang bir gün SimulatedPlayer'ı @minecraft/server'a taşırsa bu
 * test kırmızıya döner ve kural yeniden ölçülür — "muhtemelen hâlâ yoktur"
 * diye devam edilmez (CLAUDE.md).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveVersion } from "@codecraft/knowledge";

import { ABSENT_APIS, checkFeasibility, feasibilityRules } from "../src/feasibility.ts";

test("girdi simülasyonu isteği yakalanır ve alternatif önerilir", () => {
  const result = checkFeasibility("Fareme basılı tutmuş gibi otomatik kazsın");
  assert.equal(result.blocked, true);
  if (!result.blocked) return;
  assert.equal(result.category, "input-simulation");
  assert.match(result.alternative, /zincirleme|komşu/i);
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
