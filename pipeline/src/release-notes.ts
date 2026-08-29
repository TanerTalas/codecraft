/**
 * Sürüm notları -> data/<sürüm>/release-notes/
 *
 * Kaynak: MicrosoftDocs/minecraft-creator, creator/Documents/Update<sürüm>.md.
 * Dosya adları üç parçalı (1.26.40), oyun sürümü dört parçalı olsa bile.
 *
 * Repo 1.2 GB — klonlanmaz, tek dosya raw üzerinden çekilir.
 *
 * Lisans CC-BY-4.0 (doğrulandı: GitHub API, docs/SOURCES.md). Atıf zorunlu,
 * o yüzden dosyanın başına kaynak künyesi ekleniyor.
 *
 * Dokümanlar oyunun gerisinde kalabiliyor. Dosya yoksa pipeline durmaz —
 * eksik sürüm notu doğrulamayı etkilemiyor, yanlış veri yazmaktan iyidir.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { HttpError, fetchText } from "./lib/fetch.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { writeTree } from "./lib/fs.ts";
import { resolveVersion, toShortVersion } from "./lib/version.ts";

const REPO = "MicrosoftDocs/minecraft-creator";
const REF = "main";
const DOCS_PATH = "creator/Documents";

export type ReleaseNotesResult = {
  /** data/<sürüm>/ içine göreli yol, doküman yoksa null. */
  path: string | null;
  written: string[];
  deleted: string[];
};

function withAttribution(version: string, file: string, body: string): string {
  return [
    "<!--",
    `Kaynak: https://github.com/${REPO}/blob/${REF}/${DOCS_PATH}/${file}`,
    `Oyun sürümü: ${version}`,
    "Lisans: CC-BY-4.0. Bu dosya pipeline tarafından olduğu gibi alındı,",
    "elle düzenlenmez.",
    "-->",
    "",
    body,
  ].join("\n");
}

export async function collectReleaseNotes(version: string): Promise<ReleaseNotesResult> {
  const file = `Update${toShortVersion(version)}.md`;
  const url = `https://raw.githubusercontent.com/${REPO}/${REF}/${DOCS_PATH}/${file}`;

  let body: string;
  try {
    body = await fetchText(url);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      console.warn(`  uyarı: ${file} yayınlanmamış — dokümanlar oyunun gerisinde`);
      // Klasörü boş kümeyle eşitle: önceki koşudan kalan not varsa temizlenir.
      const empty = await writeTree(join(DATA_DIR, version, "release-notes"), new Map());
      return { path: null, ...empty };
    }
    throw error;
  }

  const files = new Map([[file, withAttribution(version, file, body)]]);
  const { written, deleted } = await writeTree(join(DATA_DIR, version, "release-notes"), files);
  return { path: `release-notes/${file}`, written, deleted };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectReleaseNotes(version);
  console.log(
    `sürüm notları -> ${result.path === null ? "yok" : `data/${version}/${result.path}`} — ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
});
