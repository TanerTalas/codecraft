/**
 * Tek vakanın ölçülmesi: üretilen dosyalar -> doğrulama + ek kontroller.
 *
 * Saf: dosya yazmaz, terminale bir şey basmaz. Runner ve rapor bunun döndürdüğü
 * sonuçtan beslenir.
 */
import { isScript, validateFiles } from "@codecraft/core";
import {
  checkCommandIdentities,
  checkFileNames,
  checkIdentities,
  checkPatterns,
  type Finding,
  type PackFile,
} from "@codecraft/validator";

import type { CaseResult, EvalCase, FileResult, Generation } from "./types.ts";

/**
 * Dosya başına doğrulayıcı seçimi ve script uzantıları @codecraft/core içinde
 * (review.ts). Üretim döngüsü de aynı fonksiyonları çağırıyor — mantık tek
 * yerde durur (CLAUDE.md, mimari kural 1).
 *
 * Burada ayrı duran tek şey ek kontrollerin SEÇİCİ koşulması: eval bir ölçüm
 * aracı ve hangi vakanın hangi hata sınıfını hedeflediği kayda geçiyor
 * (expect.checks). Üretim tarafı hepsini koşar.
 */

/**
 * İstenen ek kontrolleri koşar.
 *
 * Kontrol adları vaka dosyasında yazılı ve yükleyici tarafından zaten
 * doğrulandı; buraya bilinmeyen bir ad gelirse hata fırlatılır.
 */
async function runChecks(
  names: readonly string[],
  files: readonly PackFile[],
  version: string,
): Promise<{ ok: boolean; findings: Finding[] }> {
  const findings: Finding[] = [];

  for (const name of names) {
    if (name === "identity") {
      findings.push(...(await checkIdentities(files, { version })).findings);
      continue;
    }
    if (name === "filename") {
      findings.push(...checkFileNames(files).findings);
      continue;
    }
    if (name === "commandIdentity") {
      // Komut sözdizimi değil, komut metnindeki kimlikler doğrulanıyor
      // (CLAUDE.md: komut sözdizimi doğrulayıcısı v1'de yok).
      for (const file of files) {
        if (!file.path.endsWith(".txt")) continue;
        findings.push(
          ...(await checkCommandIdentities(file.content, { version, path: file.path })).findings,
        );
      }
      continue;
    }
    if (name.startsWith("pattern:")) {
      const only = [name.slice("pattern:".length)];
      for (const file of files) {
        if (!isScript(file.path)) continue;
        findings.push(...checkPatterns(file.content, { path: file.path, only }).findings);
      }
      continue;
    }
    throw new Error(`Bilinmeyen kontrol: "${name}"`);
  }

  return { ok: findings.every((finding) => finding.severity !== "error"), findings };
}

export async function evaluateCase(
  testCase: EvalCase,
  generation: Generation,
): Promise<CaseResult> {
  const files: FileResult[] = await validateFiles(generation.files, testCase.version);

  // Bir dosya doğrulayıcıdan geçmediyse bile istenen bir kontrol koştuysa vaka
  // ölçülmüştür: komut vakaları tam olarak bu durumda — sözdizimi
  // doğrulanamıyor ama kimlikler doğrulanabiliyor.
  const measured =
    files.some((file) => file.validator !== "atlandı") || testCase.expect.checks.length > 0;
  const validation = measured && files.every((file) => file.ok);
  const checks = await runChecks(testCase.expect.checks, generation.files, testCase.version);

  return {
    case: testCase,
    files,
    measured,
    validation,
    checks,
    ok: validation && checks.ok,
  };
}

/** Üretici ya da ölçüm patladığında vaka "geçti" görünmesin diye. */
export function failedCase(testCase: EvalCase, error: unknown): CaseResult {
  return {
    case: testCase,
    files: [],
    measured: false,
    validation: false,
    checks: { ok: false, findings: [] },
    ok: false,
    failure: error instanceof Error ? error.message : String(error),
  };
}
