/**
 * Vaka dosyasının biçimi ve yükleyicinin katılığı.
 *
 * Yükleyicinin gevşek olmaması ölçüt açısından kritik: vaka dosyasındaki bir
 * yazım hatası sessizce atlanırsa "20'de 18" sayısı yanlış sayar.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { GATE_REQUIRED, MEASURABLE, loadCases } from "../src/cases.ts";
import type { EvalCase } from "../src/types.ts";

const cases = await loadCases();

/** Geçici bir vaka dosyası yazıp yükletir — yükleyicinin reddi ölçülür. */
async function loadTemp(value: unknown): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "codecraft-eval-"));
  try {
    const path = join(dir, "cases.json");
    await writeFile(path, JSON.stringify(value), "utf8");
    await loadCases(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const valid: EvalCase = {
  id: "ornek-01",
  request: "Test",
  version: "1.26.40",
  kind: "script",
  expect: { validation: "pass", checks: [] },
};

test("geçiş kapısı: core listesi tam 20 vaka", () => {
  assert.equal(cases.core.length, 20);
  assert.equal(GATE_REQUIRED, 18);
});

test("core yalnızca ölçülebilir tiplerden oluşuyor", () => {
  for (const testCase of cases.core) {
    assert.ok(
      MEASURABLE.includes(testCase.kind),
      `${testCase.id}: "${testCase.kind}" kapıya sayılamaz`,
    );
  }
});

test("ölçülemeyen tipler extra listesinde duruyor", () => {
  const kinds = new Set(cases.extra.map((testCase) => testCase.kind));
  assert.ok(kinds.has("command"), "komut vakası yok");
  assert.ok(kinds.has("python"), "python vakası yok");
});

test("VALIDATION-LIMITS sınıfları karşılıksız kalmıyor", () => {
  // Sadece "validator geçti" ölçütü D sınıfını görünmez bırakırdı
  // (docs/VALIDATION-LIMITS.md). Sayılar plandaki alt sınırlar.
  const withCheck = (name: string): number =>
    cases.core.filter((testCase) => testCase.expect.checks.includes(name)).length;

  assert.ok(withCheck("pattern:welcome-on-player-spawn") >= 3, "D sınıfı için en az 3 vaka olmalı");
  assert.ok(withCheck("identity") >= 2, "A sınıfı için en az 2 vaka olmalı");
  assert.ok(withCheck("filename") >= 1, "B sınıfı için en az 1 vaka olmalı");
});

test("yükleyici: bilinmeyen kontrol adı reddediliyor", async () => {
  await assert.rejects(
    () => loadTemp({ core: [{ ...valid, expect: { validation: "pass", checks: ["uydurma"] } }], extra: [] }),
    /bilinmeyen kontrol/i,
  );
  await assert.rejects(
    () =>
      loadTemp({
        core: [{ ...valid, expect: { validation: "pass", checks: ["pattern:yok-boyle"] } }],
        extra: [],
      }),
    /bilinmeyen kalıp/i,
  );
});

test("yükleyici: eksik alan ve ölçülemeyen tip reddediliyor", async () => {
  await assert.rejects(() => loadTemp({ core: [{ ...valid, request: "" }], extra: [] }), /request/);
  await assert.rejects(
    () => loadTemp({ core: [{ ...valid, kind: "command" }], extra: [] }),
    /core listesinde duramaz/,
  );
  await assert.rejects(() => loadTemp({ extra: [] }), /"core" listesi yok/);
});

test("yükleyici: aynı kimlik iki kez geçemez", async () => {
  await assert.rejects(
    () => loadTemp({ core: [valid], extra: [{ ...valid, kind: "command" }] }),
    /iki kez geçiyor/,
  );
});
