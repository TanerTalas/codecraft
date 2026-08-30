/**
 * Kaynak dosyalarda ham NUL baytı bulunmamalı.
 *
 * NEDEN VAR: `evals/src/generators/model.ts` içindeki parmak izi ayracı bir
 * NUL karakteri ve bu doğru bir tercih — metinde geçemeyeceği için birleşen
 * alanlar birbirine karışmıyor. Ama kaynağa **ham bayt** olarak yazılmıştı.
 *
 * İki sonucu vardı: `grep` dosyayı "binary" sayıp içinde arama yapmıyordu, ve
 * herhangi bir formatter ya da editör o baytı sessizce silseydi bütün parmak
 * izleri değişir, 20 vakalık model önbelleği tümden geçersiz olur ve bir
 * sonraki kapı koşusu günlük kotanın tamamını harcardı.
 *
 * Kaçış dizisine çevrildi (üretilen metin birebir aynı, önbellek korundu).
 * Bu test baytın geri gelmesini yakalar.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Elle yazılan kaynağın durduğu yerler. Üretilen çıktı ve veri dışarıda. */
const SOURCE_DIRS = [
  "packages/core/src",
  "packages/validator/src",
  "packages/knowledge/src",
  "pipeline/src",
  "evals/src",
  "app/src",
];

async function collect(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // klasör yoksa sessiz geç: app/ henüz kurulmamış olabilir
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(path, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
}

test("kaynak dosyalarda ham NUL baytı yok", async () => {
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) await collect(join(ROOT, dir), files);

  assert.ok(files.length > 0, "hiç kaynak dosya bulunamadı — yol listesi bozulmuş olabilir");

  const offenders: string[] = [];
  for (const path of files) {
    const bytes = await readFile(path);
    const index = bytes.indexOf(0);
    if (index >= 0) offenders.push(`${path.slice(ROOT.length)} (bayt ${index})`);
  }

  assert.deepEqual(
    offenders,
    [],
    `Ham NUL baytı bulundu:\n  ${offenders.join("\n  ")}\n` +
      "Kaçış dizisi kullan: ters bölü + u0000.",
  );
});
