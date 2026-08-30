/**
 * Üretilen paketi diske yazma ve oyuna kurma.
 *
 * Oyun klasörünün yeri @codecraft/knowledge içinde çözülüyor (game-paths.ts):
 * orayı hem bu CLI hem validator'ın ölçüm script'i kullanıyor, mantık tek
 * yerde durur.
 */
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { findDevPacksDir } from "@codecraft/knowledge";

import type { GeneratedFile } from "./output.ts";

/** Dosyaları klasöre yazar. Eski içerik silinir: bayat dosya kalmasın. */
export async function writePack(dir: string, files: readonly GeneratedFile[]): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  for (const file of files) {
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

/**
 * BP/ klasörünü oyunun geliştirme klasörüne kopyalar ve hedefi döndürür.
 *
 * Yalnızca BP/ kurulur: answer.txt ve automation/*.py oyuna yüklenmez, onlar
 * kullanıcının okuyacağı çıktılar.
 */
export async function installPack(sourceDir: string, packName: string): Promise<string> {
  const devPacks = await findDevPacksDir();
  const target = join(devPacks, packName);
  await mkdir(devPacks, { recursive: true });
  await rm(target, { recursive: true, force: true });
  await cp(join(sourceDir, "BP"), target, { recursive: true });
  return target;
}
