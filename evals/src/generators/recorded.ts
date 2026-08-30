/**
 * Kayıtlı üretici — Aşama 2.5.
 *
 * evals/recorded/<vaka-id>/ altındaki dosya ağacını olduğu gibi döndürür.
 *
 * Bu dosyalar ELLE YAZILMIŞ. Model çıktısı değiller ve öyleymiş gibi
 * raporlanmıyorlar: provenance satırı hem terminale hem HTML rapora basılır.
 * Amaçları tezgâhı bugün ölçülebilir kılmak — runner'ın her dalı (şema düşüşü,
 * tsc düşüşü, kimlik, dosya adı ve kalıp kontrolü) gerçekten koşuyor.
 *
 * Aşama 3 aynı arayüzü uygulayan bir model üreticisi ekler; runner değişmez.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { EvalCase, Generation, GeneratedFile, Generator } from "../types.ts";

export const RECORDED_DIR = fileURLToPath(new URL("../../recorded/", import.meta.url));

/** Paket köküne göreli yol. Windows ayracı posix'e çevrilir. */
const toRelative = (root: string, path: string): string =>
  path.slice(root.length + 1).split(sep).join(posix.sep);

async function readTree(root: string, dir: string, out: GeneratedFile[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // Nokta ile baslayan girdiler atlanir: model onbellegi kendi ustverisini
    // (.codecraft-cache.json) vaka klasorune yaziyor ve o bir paket dosyasi
    // degil. Dogrulayiciya verilirse "tip cozumlenemedi" hatasi uretir.
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await readTree(root, path, out);
      continue;
    }
    out.push({ path: toRelative(root, path), content: await readFile(path, "utf8") });
  }
}

export const RECORDED_PROVENANCE =
  "elle yazılmış kayıt (evals/recorded/) — model çıktısı değil";

/**
 * Dosya ağacını olduğu gibi döndüren üretici.
 *
 * `name` ve `provenance` parametre: aynı okuyucu model çıktısının önbelleğini
 * de oynatıyor (--generator=cached) ve orada "elle yazılmış" demek yalan
 * olurdu. Çıktının nereden geldiği hem terminale hem rapora basılıyor.
 */
export function recordedGenerator(
  dir: string = RECORDED_DIR,
  provenance: string = RECORDED_PROVENANCE,
  name = "recorded",
): Generator {
  return {
    name,
    provenance,

    async generate(testCase: EvalCase): Promise<Generation> {
      const root = join(dir, testCase.id);

      const files: GeneratedFile[] = [];
      try {
        await readTree(root, root, files);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        // Eksik klasör sessizce boş çıktı olmaz: boş çıktı "hata yok" gibi
        // görünür ve vaka yanlışlıkla geçmiş sayılabilirdi.
        throw new Error(`${testCase.id}: kayıtlı çıktı okunamadı (${root}) — ${reason}`);
      }

      if (files.length === 0) {
        throw new Error(`${testCase.id}: ${root} boş, kayıtlı çıktı yok`);
      }

      files.sort((a, b) => (a.path < b.path ? -1 : 1));
      return { files };
    },
  };
}
