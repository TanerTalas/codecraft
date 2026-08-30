/**
 * Runner'ın ölçüm katmanı.
 *
 * Asıl mesele negatif kontrol: kayıtlı bir çıktı bozulduğunda vaka gerçekten
 * kırmızıya dönüyor mu. Dönmüyorsa "15/20 geçti" sayısı hiçbir şey ölçmüyor
 * demektir.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { loadCases } from "../src/cases.ts";
import { evaluateCase } from "../src/evaluate.ts";
import { recordedGenerator } from "../src/generators/recorded.ts";
import { status } from "../src/report.ts";
import type { EvalCase } from "../src/types.ts";

const cases = await loadCases();
const generator = recordedGenerator();

const find = (id: string): EvalCase => {
  const testCase = [...cases.core, ...cases.extra].find((entry) => entry.id === id);
  if (testCase === undefined) throw new Error(`vaka yok: ${id}`);
  return testCase;
};

const run = (id: string) => generator.generate(find(id)).then((g) => evaluateCase(find(id), g));

test("kayıtlı üretici bilinmeyen vakada sessizce boş dönmüyor", async () => {
  await assert.rejects(
    () => generator.generate({ ...find("chain-mining-01"), id: "boyle-bir-vaka-yok" }),
    /kayıtlı çıktı okunamadı/,
  );
});

test("negatif kontrol: geçen bir çıktı bozulunca vaka düşüyor", async () => {
  const testCase = find("chain-mining-01");
  const generation = await generator.generate(testCase);
  assert.equal((await evaluateCase(testCase, generation)).ok, true, "temel hâli geçmeliydi");

  // Kaldırılmış 1.x API'si: tsc yakalamalı.
  const broken = {
    files: generation.files.map((file) => ({
      ...file,
      content: file.content.replace("world.afterEvents", "world.events"),
    })),
  };
  const result = await evaluateCase(testCase, broken);

  assert.equal(result.ok, false, "bozulmuş çıktı geçmemeliydi");
  assert.equal(result.validation, false);
  assert.ok(result.files.some((file) => file.errors.length > 0));
});

test("düşen vakaların her biri farklı bir sınıfı gösteriyor", async () => {
  // evals/recorded/README.md bu beş vakayı sayıyor. Biri sessizce geçmeye
  // başlarsa runner'ın o dalı artık koşulmuyor demektir.
  const schema = await run("custom-item-01");
  assert.equal(schema.validation, false, "ajv düşüşü bekleniyordu");

  const script = await run("mob-timer-01");
  assert.equal(script.validation, false, "tsc düşüşü bekleniyordu");

  const identity = await run("recipe-ruby-01");
  assert.equal(identity.validation, true, "şema geçmeliydi, düşen kontrol olmalı");
  assert.ok(identity.checks.findings.some((finding) => finding.check === "identity"));

  const filename = await run("ore-gen-01");
  assert.equal(filename.validation, true);
  assert.ok(filename.checks.findings.some((finding) => finding.check === "filename"));

  const pattern = await run("welcome-message-01");
  assert.equal(pattern.validation, true);
  assert.ok(pattern.checks.findings.some((finding) => finding.check.startsWith("pattern:")));
});

test("ölçülemeyen çıktı düşmüş sayılmıyor", async () => {
  const result = await run("python-afk-fish-01");
  assert.equal(result.measured, false);
  assert.equal(status(result), "ölçülemedi");
});
