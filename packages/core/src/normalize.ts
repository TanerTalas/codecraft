/**
 * Üretim tarafı düzeltmeleri.
 *
 * checkFileNames kuralı ÖLÇÜYOR; burası DÜZELTİYOR. Ayrım kasıtlı:
 * "dosya adı içerikten türetilmeli" bir doğrulama sorunu değil, üretim
 * sorunu (docs/VALIDATION-LIMITS.md B, TODO.md Aşama 3).
 *
 * Yalnızca ÖLÇÜLMÜŞ kural kodlanıyor. Bugün tek kural feature rule kuralı:
 * 30-08-2026'da oyun dosyayı reddetti, ad düzeltilince hata kayboldu. Başka
 * dosya tipleri için benzer kurallar olabilir ama ölçülmedi.
 *
 * Saf modül: ağ yok, dosya sistemi yok.
 */
import type { GeneratedFile } from "./output.ts";

export type Fix = {
  rule: string;
  from: string;
  to: string;
  reason: string;
};

export type NormalizeResult = {
  files: GeneratedFile[];
  /** Ne değiştiği. Kullanıcıya ve rapora gösterilir, sessizce düzeltilmez. */
  fixes: Fix[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Dosyanın klasörünü koruyarak adını değiştirir. */
function rename(path: string, name: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? `${name}.json` : `${path.slice(0, cut)}/${name}.json`;
}

/**
 * feature rule dosyasının adını identifier'ın namespace'siz hâlinden türetir.
 *
 * normalizeId burada gerekmiyor: kural namespace'i ATIYOR, dolayısıyla
 * namespace'siz bir identifier zaten kendisidir.
 */
export function normalize(files: readonly GeneratedFile[]): NormalizeResult {
  const out: GeneratedFile[] = [];
  const fixes: Fix[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".json")) {
      out.push(file);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      // Ayrıştırılamayan dosyaya dokunulmaz: validateJson bunu zaten
      // ayrıntısıyla raporluyor ve burada tahmin yürütmek yanlış olur.
      out.push(file);
      continue;
    }

    const root = isObject(parsed) ? parsed["minecraft:feature_rules"] : undefined;
    const identifier = isObject(root) && isObject(root["description"])
      ? root["description"]["identifier"]
      : undefined;

    if (typeof identifier !== "string") {
      out.push(file);
      continue;
    }

    const expected = identifier.split(":").slice(-1)[0] as string;
    const actual = (file.path.split("/").pop() as string).replace(/\.json$/, "");
    if (actual === expected) {
      out.push(file);
      continue;
    }

    const to = rename(file.path, expected);
    fixes.push({
      rule: "filename",
      from: file.path,
      to,
      reason:
        `feature rule identifier'ı "${identifier}", oyun dosya adının ` +
        `"${expected}.json" olmasını şart koşuyor`,
    });
    out.push({ path: to, content: file.content });
  }

  return { files: out, fixes };
}
