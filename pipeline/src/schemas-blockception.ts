/**
 * Blockception şemaları -> data/blockception/
 *
 * Neden sürüm klasörünün içinde değil: kaynak oyun sürümüne göre klasörlenmiyor,
 * `main` dalı tek bir güncel küme tutuyor. Her sürüme kopyalamak olmayan bir
 * kesinlik iddia ederdi. Sürüm klasöründeki index.json bu kümeye yol ve içerik
 * özeti ile işaret eder.
 *
 * Sürüm etiketleri geride kalabildiği için tag'e değil `main` dalına bakılır
 * (docs/SOURCES.md).
 *
 * Lisans BSD-3-Clause: yeniden dağıtım serbest, ama telif bildirimi korunmalı —
 * LICENSE dosyası şemalarla birlikte kopyalanıyor.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { downloadTarball } from "./lib/github.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { hashTree, writeTree } from "./lib/fs.ts";

export const BLOCKCEPTION_REPO = "Blockception/Minecraft-bedrock-json-schemas";
export const BLOCKCEPTION_REF = "main";

/** data/ köküne göreli. index.json bu yolu yazar, validator oradan okur. */
export const BLOCKCEPTION_DIR = "blockception";

export type BlockceptionResult = {
  files: number;
  written: string[];
  deleted: string[];
  hash: string;
};

export async function collectBlockception(): Promise<BlockceptionResult> {
  const archive = await downloadTarball(BLOCKCEPTION_REPO, BLOCKCEPTION_REF);

  const files = new Map<string, Buffer>();
  for (const [path, content] of archive) {
    if (path === "LICENSE" || (path.startsWith("source/") && path.endsWith(".json"))) {
      files.set(path, content);
    }
  }

  if (!files.has("LICENSE")) {
    throw new Error(`${BLOCKCEPTION_REPO}: LICENSE bulunamadı — BSD-3-Clause şartı gereği zorunlu`);
  }
  if (files.size < 2) {
    throw new Error(`${BLOCKCEPTION_REPO}: source/ altında şema yok — yol değişmiş olabilir`);
  }

  const { written, deleted } = await writeTree(join(DATA_DIR, BLOCKCEPTION_DIR), files);
  return { files: files.size, written, deleted, hash: hashTree(files) };
}

runIfMain(import.meta.url, async () => {
  const result = await collectBlockception();
  console.log(
    `blockception -> data/${BLOCKCEPTION_DIR}/ — ${result.files} dosya, ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
});
