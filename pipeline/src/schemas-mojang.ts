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

/**
 * Klasörün kaynağını ve lisansını yazan künye.
 *
 * writeTree haritada olmayan HER dosyayı siliyor, yani bu dosya elle
 * yazılamaz — ilk pipeline koşusunda sessizce silinirdi. Aynı sebeple
 * script-types de künyesini üretiyor (`pipeline/src/script-types.ts`).
 */
export function renderNotice(version: string, fileCount: number): string {
  return `# Mojang şema kaynak künyesi

Bu klasördeki JSON şemaları \`${BEDROCK_SAMPLES_REPO}\` deposundaki
\`${PREFIX}\` içeriğinin **birebir** kopyasıdır. Dosyalar elle düzenlenmez,
\`pipeline/src/schemas-mojang.ts\` üretir.

| | |
|---|---|
| Kaynak | \`${BEDROCK_SAMPLES_REPO}\` → \`${PREFIX}\` |
| Sürüm | ${version} |
| Dosya | ${fileCount} (bu künye hariç) |
| Lisans | Minecraft End User License Agreement |

Deponun \`LICENSE.md\` dosyasının metni (doğrulandı 30-08-2026, HTTP 200):

> (c) Mojang AB. All rights reserved.
>
> By downloading the files in this repository, you agree to the Minecraft End
> User License Agreement and that these files are subject to its terms.

## Bunlar doğrulamada kullanılmıyor

CodeCraft'ın JSON doğrulaması **Blockception'ın derlenmiş şemalarını**
kullanıyor (\`data/blockception/compiled/\`, BSD-3-Clause). Bu klasör sürüm
farklarını okumak ve ikinci bir kontrol için duruyor.

Ölçüldü 02-09-2026: \`packages/*/src\` ve \`app/src\` içinde bu klasöre
**sıfır** referans var. Bu yüzden dosyalar Vercel fonksiyon paketine de
girmiyor (\`app/next.config.ts\`, \`DATA_FILES\`) — okunmayan içerik üçüncü bir
tarafa yüklenmiyor.

Karar ve gerekçesi: \`docs/SOURCES.md\`.
`;
}

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
  // İndeks künyeden ÖNCE çıkarılıyor: NOTICE.md bir şema değil ve
  // indexFormatVersions'a girerse schemas-index.json'a sahte bir tip düşerdi.
  const schemaPaths = [...files.keys()];
  const fileCount = files.size;
  files.set("NOTICE.md", renderNotice(version, fileCount));
  const { written, deleted } = await writeTree(outDir, files);

  const formatVersions = indexFormatVersions(schemaPaths);
  if (await writeIfChanged(join(DATA_DIR, version, "schemas-index.json"), toJson(formatVersions))) {
    written.push("../schemas-index.json");
  }

  return { files: fileCount, written, deleted, formatVersions };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectMojangSchemas(version);
  console.log(
    `mojang şemaları -> data/${version}/schemas/ — ${result.files} dosya, ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
});
