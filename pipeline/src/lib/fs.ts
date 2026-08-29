/**
 * Yazma katmanı. İki kural burada uygulanıyor:
 *
 * 1. İçerik değişmediyse dosyaya dokunulmaz — günlük cron'un "değişiklik varsa
 *    commit et" davranışı buna dayanıyor.
 * 2. Çıktı deterministiktir; zaman damgası veya commit SHA yazılmaz.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";

export const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const sha256 = (content: string | Buffer): string =>
  createHash("sha256").update(content).digest("hex");

/** İçerik aynıysa dosyaya dokunmaz. true = yazıldı. */
export async function writeIfChanged(path: string, content: string | Buffer): Promise<boolean> {
  const next = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  try {
    if ((await readFile(path)).equals(next)) return false;
  } catch {
    // dosya henüz yok
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next);
  return true;
}

/** Bir klasördeki tüm dosyaları, klasöre göreli POSIX yollarıyla listeler. */
async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1).split(sep).join(posix.sep));
  } catch {
    return []; // klasör henüz yok
  }
}

export type TreeResult = { written: string[]; deleted: string[] };

/**
 * Bir klasörü verilen dosya kümesiyle eşitler. Kaynakta artık olmayan dosyalar
 * silinir — upstream'de kaldırılan bir şema data/ içinde hayalet olarak kalmasın.
 */
export async function writeTree(
  dir: string,
  files: ReadonlyMap<string, string | Buffer>,
): Promise<TreeResult> {
  const written: string[] = [];
  for (const [relative, content] of files) {
    if (await writeIfChanged(join(dir, relative), content)) written.push(relative);
  }

  const deleted: string[] = [];
  for (const relative of await listFiles(dir)) {
    if (files.has(relative)) continue;
    await rm(join(dir, relative));
    deleted.push(relative);
  }

  return { written: written.sort(), deleted: deleted.sort() };
}

/** Bir dosya kümesinin içerik özeti. Yol sırasından bağımsız olsun diye sıralanır. */
export function hashTree(files: ReadonlyMap<string, string | Buffer>): string {
  const hash = createHash("sha256");
  for (const relative of [...files.keys()].sort()) {
    hash.update(relative).update("\0").update(files.get(relative) ?? "").update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
