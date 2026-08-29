/**
 * Mojang'ın kendi JSON şemaları -> data/<sürüm>/schemas/
 *
 * Kaynak: bedrock-samples/metadata/json_schemas/. Bu şemalar oyunla birlikte
 * yayınlanıyor, yani gerçekten sürüme kilitli — Blockception'dan farkı bu
 * (docs/SOURCES.md).
 *
 * Klasör yapısı <kapsam>/<tip>/<format_version>/ biçiminde ve aynen korunuyor:
 * şemalar birbirine göreli $ref veriyor, ağaç bozulursa ajv referansları çözemez.
 *
 * Hangi kaynağın kullanılacağı (Mojang mı Blockception mı) Aşama 2'ye bırakıldı,
 * pipeline ikisini de çeker.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { downloadPaths, fetchTree } from "./lib/github.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged, writeTree } from "./lib/fs.ts";
import { BEDROCK_SAMPLES_REF, BEDROCK_SAMPLES_REPO, resolveVersion } from "./lib/version.ts";

const PREFIX = "metadata/json_schemas/";

export type MojangSchemaResult = {
  files: number;
  written: string[];
  deleted: string[];
  /** { "server/block": ["1.20.60", "1.26.20"] } — Aşama 2 doğru şemayı bununla seçecek. */
  formatVersions: Record<string, string[]>;
};

/** Yol biçimi: <kapsam>/<tip>/<format_version>/<dosya>.json */
function indexFormatVersions(paths: readonly string[]): Record<string, string[]> {
  const groups = new Map<string, Set<string>>();
  for (const path of paths) {
    const parts = path.split("/");
    if (parts.length < 4) continue; // format_version katmanı yok, indekse girmez
    const key = `${parts[0]}/${parts[1]}`;
    let versions = groups.get(key);
    if (versions === undefined) {
      versions = new Set();
      groups.set(key, versions);
    }
    versions.add(parts[2] as string);
  }
  return Object.fromEntries(
    [...groups]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, values]) => [
        key,
        [...values].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
      ]),
  );
}

export async function collectMojangSchemas(version: string): Promise<MojangSchemaResult> {
  const tree = await fetchTree(BEDROCK_SAMPLES_REPO, BEDROCK_SAMPLES_REF);
  const paths = tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(PREFIX))
    .map((entry) => entry.path)
    .sort();

  if (paths.length === 0) {
    throw new Error(`${BEDROCK_SAMPLES_REPO}: ${PREFIX} altında dosya yok — yol değişmiş olabilir`);
  }

  const downloaded = await downloadPaths(BEDROCK_SAMPLES_REPO, BEDROCK_SAMPLES_REF, paths);
  const files = new Map<string, string>();
  for (const [path, content] of downloaded) files.set(path.slice(PREFIX.length), content);

  const outDir = join(DATA_DIR, version, "schemas");
  const { written, deleted } = await writeTree(outDir, files);

  const formatVersions = indexFormatVersions([...files.keys()]);
  if (await writeIfChanged(join(DATA_DIR, version, "schemas-index.json"), toJson(formatVersions))) {
    written.push("../schemas-index.json");
  }

  return { files: files.size, written, deleted, formatVersions };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectMojangSchemas(version);
  console.log(
    `mojang şemaları -> data/${version}/schemas/ — ${result.files} dosya, ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
});
