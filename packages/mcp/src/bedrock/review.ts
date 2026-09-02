/**
 * Doğrulama toplayıcı: bir dosya kümesi -> tek sonuç + eyleme dönüştürülebilir
 * özet. `review_pack` aracının gövdesi.
 *
 * Node'a bağlı (tsc, ajv, fs) ve öyle kalması serbest — doğrulama sunucuda
 * koşar. Dosya başına doğru doğrulayıcıyı kendi seçer; ikinci bir doğrulama
 * yolu yok.
 */
import {
  checkCommandIdentities,
  checkAssets,
  checkFileNames,
  checkIdentities,
  checkManifest,
  checkMolang,
  checkPatterns,
  checkReferences,
  checkSounds,
  validateCommand,
  validateJson,
  validateScript,
  type Finding,
  type PackFile,
} from "@codecraft/validator";

/** tsc'ye giden uzantılar. Üretilen paketler .js yazar, tsc ikisini de derler. */
export const SCRIPT_EXTENSIONS = [".js", ".ts", ".mjs"];

export const isScript = (path: string): boolean =>
  SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension));

/** Tek dosyanın doğrulama sonucu. */
export type FileResult = {
  path: string;
  /** Hangi doğrulayıcı koştu. "atlandı": ne json ne script. */
  validator: "json" | "script" | "atlandı";
  ok: boolean;
  /** Çözümlenen doküman tipi ya da derlenen modül sürümleri. */
  detail: string;
  /** İnsan okunur hata satırları. */
  errors: string[];
};

/**
 * Tek dosyayı uzantısına göre doğrular.
 *
 * Tip çözümlenemeyen bir JSON sessizce atlanmaz: dosya paket içinde tanınmayan
 * bir yerde duruyor demektir ve bu da bir üretim hatasıdır.
 */
export async function validateFile(file: PackFile, version: string): Promise<FileResult> {
  if (file.path.endsWith(".json")) {
    try {
      const result = await validateJson(file.content, file.path, version);
      return {
        path: file.path,
        validator: "json",
        ok: result.ok,
        detail: result.type,
        errors: result.errors.map((error) =>
          error.kind === "parse"
            ? `JSON: ${error.message}`
            : `${error.path || "/"} :: ${error.message}`,
        ),
      };
    } catch (error) {
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

export async function validateFiles(
  files: readonly PackFile[],
  version: string,
): Promise<FileResult[]> {
  const results: FileResult[] = [];
  for (const file of files) results.push(await validateFile(file, version));
  return results;
}

/**
 * Paketin kendi tanımladığı kimlikler.
 *
 * Komut kontrolü bunu kullanıyor: aynı üretimde "codecraft:ruby" tanımlanıp
 * komutta kullanılmışsa doğrulanabilir hâle gelir, yoksa uyarı kalır.
 */
function declaredIdentifiers(files: readonly PackFile[]): string[] {
  const ids: string[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      continue; // validateJson bunu zaten raporluyor
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    for (const body of Object.values(parsed as Record<string, unknown>)) {
      if (typeof body !== "object" || body === null) continue;
      const description = (body as Record<string, unknown>)["description"];
      if (typeof description !== "object" || description === null) continue;
      const id = (description as Record<string, unknown>)["identifier"];
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}

/**
 * Komut metnindeki her satırı Mojang'ın komut tanımına karşı doğrular.
 *
 * Boş satırlar ve `#` ile başlayanlar atlanıyor: `.mcfunction` dosyalarında
 * yorum böyle yazılıyor ve aynı biçimi kabul etmek makul.
 */
async function commandSyntaxFindings(file: PackFile, version: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const [i, raw] of file.content.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const result = await validateCommand(line, { version });
    if (result.ok) continue;

    for (const error of result.errors) {
      findings.push({
        check: "commandSyntax",
        severity: "error",
        path: file.path,
        message: `satır ${i + 1}: ${error.message}`,
        evidence:
          "Mojang komut tanımı (bedrock-samples metadata/command_modules)" +
          (result.usage.length > 0 ? `. Kullanım: ${result.usage.join(" | ")}` : ""),
      });
    }
  }

  return findings;
}

export type Review = {
  /** En az bir dosya ajv ya da tsc ile ölçülebildi mi. */
  measured: boolean;
  /** Ölçülebilen bütün dosyalar geçti mi. */
  validation: boolean;
  files: FileResult[];
  findings: Finding[];
  /** validation && hiçbir "error" bulgusu yok. */
  ok: boolean;
  /** Retry istemine giren metin. ok ise boş. */
  report: string;
};

/**
 * Üretim yolunda BÜTÜN kontroller koşar.
 *
 * Eval tarafı seçici koşuyor (expect.checks) çünkü orası bir ölçüm aracı:
 * hangi vakanın hangi sınıfı hedeflediği kayda geçiyor. Üretimde seçmek
 * anlamsız — kullanıcı bütün hataları görmeli.
 */
export async function review(files: readonly PackFile[], version: string): Promise<Review> {
  const results = await validateFiles(files, version);

  const findings: Finding[] = [];
  findings.push(...(await checkIdentities(files, { version })).findings);
  findings.push(...checkFileNames(files).findings);
  findings.push(...checkManifest(files).findings);
  findings.push(...(await checkAssets(files, { version })).findings);
  // Molang JSON stringlerinin icinde duruyor; ne sema ne tsc oraya bakiyor.
  findings.push(...(await checkMolang(files, { version })).findings);
  // minecraft:loot ve trade_table bir dosya YOLUNA isaret ediyor, kimlige degil.
  findings.push(...(await checkReferences(files, { version })).findings);
  for (const file of files) {
    if (isScript(file.path)) {
      findings.push(...checkPatterns(file.content, { path: file.path }).findings);
      continue;
    }
    // Komut çıktısı düz metin dosyasına geliyor. İki kontrol
    // koşuyor: sözdizimi (Mojang'ın komut tanımına karşı) ve kimlikler.
    if (file.path.endsWith(".txt")) {
      findings.push(...(await commandSyntaxFindings(file, version)));
      // Ses olaylari kimlik degil, nokta ayrac.li ad: kimlik regex'i gormuyor.
      findings.push(...(await checkSounds(file.content, { version, path: file.path })).findings);
      findings.push(
        ...(
          await checkCommandIdentities(file.content, {
            version,
            path: file.path,
            declared: declaredIdentifiers(files),
          })
        ).findings,
      );
    }
  }

  const measured = results.some((file) => file.validator !== "atlandı");
  const validation = measured && results.every((file) => file.ok);
  const ok = validation && findings.every((finding) => finding.severity !== "error");

  return {
    measured,
    validation,
    files: results,
    findings,
    ok,
    report: ok ? "" : buildReport(results, findings),
  };
}

/**
 * Retry istemine giren hata metni.
 *
 * Bulgunun `evidence` alanı da yazılıyor: kuralın nereden geldiğini görmek
 * modelin "kuralı uydurulmuş sayıp yok sayma" eğilimini kesiyor.
 */
export function buildReport(
  files: readonly FileResult[],
  findings: readonly Finding[],
): string {
  const lines: string[] = [];

  for (const file of files) {
    if (file.ok) continue;
    lines.push(`${file.path} (${file.validator}, ${file.detail}):`);
    for (const error of file.errors) lines.push(`  - ${error}`);
  }

  for (const finding of findings) {
    if (finding.severity !== "error") continue;
    lines.push(`${finding.path ?? "(paket)"} [${finding.check}]:`);
    lines.push(`  - ${finding.message}`);
    lines.push(`    kanıt: ${finding.evidence}`);
  }

  return lines.join("\n");
}

/** Doğrulayıcıyı parametre olarak alan çağıranların beklediği imza. */
export type ReviewFn = (files: readonly PackFile[], version: string) => Promise<Review>;
