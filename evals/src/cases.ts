/**
 * Vaka dosyasını okur ve biçimini doğrular.
 *
 * Doğrulama gevşek değil: bilinmeyen bir kontrol adı ya da eksik alan sessizce
 * atlanmaz, hata fırlatır. Vaka dosyasındaki bir yazım hatası "kontrol geçti"
 * gibi görünürse eval ölçüt olmaktan çıkar.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { patternNames } from "@codecraft/validator";

import type { EvalCase, EvalCases, EvalKind } from "./types.ts";

export const CASES_FILE = fileURLToPath(new URL("../cases/cases.json", import.meta.url));

/** Geçiş kapısı: core listesinde bu kadar vaka geçmeli (docs/ROADMAP.md). */
export const GATE_REQUIRED = 18;

/** Bugün otomatik ölçülebilen tipler. Kapıya yalnızca bunlar sayılır. */
export const MEASURABLE: readonly EvalKind[] = ["script", "json"];

const KINDS: readonly EvalKind[] = ["script", "json", "command", "python"];

/** "identity" · "filename" · "commandIdentity" · "pattern:<tanınan ad>" */
function assertCheckName(name: string, caseId: string): void {
  if (
    name === "identity" ||
    name === "filename" ||
    name === "commandIdentity" ||
    name === "commandSyntax" ||
    name === "manifest" ||
    name === "asset"
  ) {
    return;
  }

  if (name.startsWith("pattern:")) {
    const pattern = name.slice("pattern:".length);
    if (patternNames().includes(pattern)) return;
    throw new Error(
      `${caseId}: bilinmeyen kalıp "${pattern}". Tanınanlar: ${patternNames().join(", ")}`,
    );
  }

  throw new Error(
    `${caseId}: bilinmeyen kontrol "${name}". ` +
      "Tanınanlar: identity, filename, manifest, asset, commandIdentity, commandSyntax, " +
      "pattern:<ad>",
  );
}

function assertCase(value: unknown, list: string, index: number): EvalCase {
  const where = `${list}[${index}]`;
  if (typeof value !== "object" || value === null) {
    throw new Error(`${where}: nesne değil`);
  }
  const testCase = value as Partial<EvalCase>;

  for (const field of ["id", "request", "version"] as const) {
    if (typeof testCase[field] !== "string" || testCase[field] === "") {
      throw new Error(`${where}: "${field}" alanı boş olmayan bir metin olmalı`);
    }
  }
  if (!KINDS.includes(testCase.kind as EvalKind)) {
    throw new Error(`${where}: "kind" ${KINDS.join(" | ")} olmalı, gelen: ${String(testCase.kind)}`);
  }

  const expect = testCase.expect;
  if (typeof expect !== "object" || expect === null) {
    throw new Error(`${where}: "expect" alanı yok`);
  }
  if (expect.validation !== "pass") {
    throw new Error(`${where}: "expect.validation" bugün yalnızca "pass" olabilir`);
  }
  if (!Array.isArray(expect.checks)) {
    throw new Error(`${where}: "expect.checks" dizi olmalı (kontrol yoksa boş dizi)`);
  }
  for (const name of expect.checks) assertCheckName(String(name), testCase.id as string);

  return testCase as EvalCase;
}

export async function loadCases(path: string = CASES_FILE): Promise<EvalCases> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;

  const read = (list: "core" | "extra"): EvalCase[] => {
    const value = parsed[list];
    if (!Array.isArray(value)) throw new Error(`${path}: "${list}" listesi yok`);
    return value.map((entry, index) => assertCase(entry, list, index));
  };

  const cases: EvalCases = { core: read("core"), extra: read("extra") };

  const ids = new Set<string>();
  for (const testCase of [...cases.core, ...cases.extra]) {
    if (ids.has(testCase.id)) throw new Error(`${path}: "${testCase.id}" kimliği iki kez geçiyor`);
    ids.add(testCase.id);
  }

  // Kapı ölçülebilir olmalı: core yalnızca bugün ölçülebilen tiplerden oluşur.
  for (const testCase of cases.core) {
    if (MEASURABLE.includes(testCase.kind)) continue;
    throw new Error(
      `${testCase.id}: "${testCase.kind}" bugün otomatik ölçülemiyor, core listesinde duramaz`,
    );
  }

  return cases;
}
