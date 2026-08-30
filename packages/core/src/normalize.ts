/**
 * Üretim tarafı düzeltmeleri.
 *
 * Kontroller ÖLÇÜYOR, burası DÜZELTİYOR. Ayrım kasıtlı: bunlar doğrulama
 * sorunu değil, üretim sorunu (docs/VALIDATION-LIMITS.md, TODO.md Aşama 3).
 * Her kuralın karşılığında onu ölçen bir kontrol var, o yüzden düzeltmenin
 * işe yaradığı negatif kontrolle sınanabiliyor.
 *
 * Yalnızca GERÇEK OYUNDA ÖLÇÜLMÜŞ kural kodlanıyor. Bugün iki tane var:
 *
 *   feature rule dosya adı   oyun dosyayı reddetti, ad düzeltilince geçti
 *   script modülü tipi       paket listede hiç görünmedi, tip düzeltilince
 *                            göründü ve script çalıştı
 *
 * İkisi de 30-08-2026'da ölçüldü. Ölçülmemiş kural buraya yazılmaz.
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
 * Script modülünü oyunun yüklediği biçime çevirir.
 *
 * `{ "type": "javascript" }` şemadan geçiyor (modül tipi listesinde var, eski
 * biçim) ama @minecraft/server 2.x ile oyun paketi hiç göstermiyor —
 * 30-08-2026'da gerçek oyunda ölçüldü, tek bu alan düzeltilince paket göründü
 * ve script çalıştı (docs/VALIDATION-LIMITS.md · E).
 *
 * Doğru biçim: `{ "type": "script", "language": "javascript", "entry": ... }`
 */
function fixScriptModule(parsed: unknown, path: string, fixes: Fix[]): boolean {
  const modules = isObject(parsed) ? parsed["modules"] : undefined;
  if (!Array.isArray(modules)) return false;

  let changed = false;
  for (const entry of modules) {
    const module = isObject(entry) ? entry : null;
    if (module === null || module["type"] !== "javascript") continue;

    module["type"] = "script";
    module["language"] = "javascript";
    changed = true;
    fixes.push({
      rule: "manifest",
      from: '"type": "javascript"',
      to: '"type": "script", "language": "javascript"',
      reason:
        "eski modül tipi @minecraft/server 2.x ile yüklenmiyor; " +
        `oyun paketi listede hiç göstermiyor (${path})`,
    });
  }
  return changed;
}

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

    if (file.path.endsWith("manifest.json")) {
      const changed = fixScriptModule(parsed, file.path, fixes);
      out.push(changed ? { path: file.path, content: JSON.stringify(parsed, null, 2) } : file);
      continue;
    }

    // feature rule dosya adı identifier'ın namespace'siz hâlinden türetiliyor.
    // normalizeId gerekmiyor: kural namespace'i zaten atıyor.
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
