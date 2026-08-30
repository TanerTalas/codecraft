/**
 * Tek vakanın ölçülmesi: üretilen dosyalar -> doğrulama + ek kontroller.
 *
 * Saf: dosya yazmaz, terminale bir şey basmaz. Runner ve rapor bunun döndürdüğü
 * sonuçtan beslenir.
 */
import {
  checkFileNames,
  checkIdentities,
  checkPatterns,
  validateJson,
  validateScript,
  type Finding,
  type PackFile,
} from "@codecraft/validator";

import type { CaseResult, EvalCase, FileResult, Generation } from "./types.ts";

/** tsc'ye giden uzantılar. Üretilen paketler .js yazar, tsc ikisini de derler. */
const SCRIPT_EXTENSIONS = [".js", ".ts", ".mjs"];

const isScript = (path: string): boolean =>
  SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension));

async function validateFile(file: PackFile, version: string): Promise<FileResult> {
  if (file.path.endsWith(".json")) {
    try {
      const result = await validateJson(file.content, file.path, version);
      return {
        path: file.path,
        validator: "json",
        ok: result.ok,
        detail: result.type,
        errors: result.errors.map((error) =>
          error.kind === "parse" ? `JSON: ${error.message}` : `${error.path || "/"} :: ${error.message}`,
        ),
      };
    } catch (error) {
      // Tip çözümlenemedi: dosya paket içinde tanınmayan bir yerde duruyor.
      // Bu da bir üretim hatası, sessizce atlanmaz.
      return {
        path: file.path,
        validator: "json",
        ok: false,
        detail: "tip çözümlenemedi",
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  if (isScript(file.path)) {
    const result = await validateScript(file.content, { version });
    const modules = Object.entries(result.modules)
      .map(([name, release]) => `${name}@${release}`)
      .join(", ");
    return {
      path: file.path,
      validator: "script",
      ok: result.ok,
      detail: modules,
      errors: result.errors.map(
        (error) => `${error.line}:${error.column} ${error.code}: ${error.message}`,
      ),
    };
  }

  return { path: file.path, validator: "atlandı", ok: true, detail: "doğrulayıcı yok", errors: [] };
}

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
  const files: FileResult[] = [];
  for (const file of generation.files) {
    files.push(await validateFile(file, testCase.version));
  }

  const measured = files.some((file) => file.validator !== "atlandı");
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
