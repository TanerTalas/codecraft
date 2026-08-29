/**
 * Aşama 2'nin bitiş kriteri.
 *
 * fixtures/cases.json içindeki "core" listesi 20 vaka: bilerek doğru 10 dosya,
 * bilerek bozuk 10 dosya (docs/ROADMAP.md). Hepsi doğru sonuç vermeli.
 *
 * Bozuk vakalarda "bir hata çıktı" yetmez — beklenen JSON pointer'da çıktığı
 * doğrulanır. Yoksa şema tamamen ilgisiz bir sebeple de patlayabilir ve test
 * yeşil kalırdı.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

import { listTypes, resolveType, validateJson } from "../src/index.ts";

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

type Case = {
  id: string;
  file: string;
  type: string;
  /** pass: geçmeli · fail: yakalanmalı · gap: şema bugün yakalamıyor */
  expect: "pass" | "fail" | "gap";
  reason?: string;
  expectedPath?: string;
  expectedKind?: "parse" | "schema";
};

const cases = JSON.parse(
  await readFile(join(FIXTURES, "cases.json"), "utf8"),
) as { core: Case[]; extra: Case[] };

async function check(testCase: Case): Promise<void> {
  const content = await readFile(join(FIXTURES, testCase.file), "utf8");
  const result = await validateJson(content, testCase.type);

  if (testCase.expect === "pass" || testCase.expect === "gap") {
    assert.equal(
      result.ok,
      true,
      `${testCase.id}: geçmesi bekleniyordu, hatalar: ${JSON.stringify(result.errors.slice(0, 3))}`,
    );
    return;
  }

  assert.equal(result.ok, false, `${testCase.id}: yakalanması bekleniyordu ama geçti`);
  assert.ok(result.errors.length > 0, `${testCase.id}: ok=false ama hata listesi boş`);

  if (testCase.expectedKind !== undefined) {
    assert.ok(
      result.errors.some((error) => error.kind === testCase.expectedKind),
      `${testCase.id}: "${testCase.expectedKind}" türünde hata bekleniyordu`,
    );
  }

  if (testCase.expectedPath !== undefined) {
    const paths = result.errors.map((error) => error.path);
    assert.ok(
      paths.includes(testCase.expectedPath),
      `${testCase.id}: hata "${testCase.expectedPath}" yolunda bekleniyordu, ` +
        `çıkanlar: ${JSON.stringify([...new Set(paths)].slice(0, 6))}`,
    );
  }
}

test("bitiş kriteri: 20 fixture", async (t) => {
  assert.equal(cases.core.length, 20, "core listesi tam 20 vaka olmalı");
  for (const testCase of cases.core) {
    await t.test(`${testCase.expect === "pass" ? "doğru" : "bozuk"}: ${testCase.id}`, () =>
      check(testCase),
    );
  }
});

test("ek ölçüm: fazladan vakalar ve bilinen şema boşlukları", async (t) => {
  for (const testCase of cases.extra) {
    await t.test(`${testCase.expect}: ${testCase.id}`, () => check(testCase));
  }
});

test("negatif kontrol: doğru fixture bozulunca yakalanıyor", async () => {
  // Şema gerçekten bakıyor mu, bunun kanıtı bu. Yirmi vaka da yeşilse ama
  // doğrulama hiçbir şey yapmıyorsa bu test kırmızıya döner.
  const content = JSON.parse(
    await readFile(join(FIXTURES, "valid/manifest-behavior-pack.json"), "utf8"),
  ) as { modules: { type: string }[] };
  (content.modules[0] as { type: string }).type = "banana";

  const result = await validateJson(content, "general/manifest");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === "/modules/0/type"));
});

test("tip çözümleme: kanonik ad, kısaltma ve dosya yolu aynı şemaya gider", async () => {
  const canonical = await resolveType("behavior/blocks/blocks");
  const short = await resolveType("behavior/blocks");
  const byPath = await resolveType("BP/blocks/ruby_ore.json");

  assert.equal(short.entry.type, canonical.entry.type);
  assert.equal(byPath.entry.type, canonical.entry.type);
});

test("tip çözümleme: bilinmeyen tip sessizce bir şemaya düşmez", async () => {
  await assert.rejects(() => resolveType("behavior/uydurma"), /çözümlenemedi/);
});

test("her tipin şeması derleniyor", async () => {
  // Bir şema bozuksa hatası ancak o tip istendiğinde çıkardı. Hepsi burada
  // bir kez derlenir: ajv'nin 60 dosyanın tamamını kabul ettiği ölçülür.
  const types = await listTypes();
  assert.ok(types.length >= 60, `beklenenden az tip: ${types.length}`);
  for (const type of types) {
    await validateJson({}, type);
  }
});
