/**
 * @codecraft/pipeline — Aşama 1 orkestratörü.
 *
 * Sürümü bir kez çözer, toplayıcıları sırayla koşturur ve sonunda kaynak
 * künyesini data/<sürüm>/index.json içine yazar.
 *
 * Toplayıcılar tek başına da koşabilir (npm run pipeline:schemas gibi) —
 * hata ayıklarken 8 MB'ı yeniden indirmemek için.
 *
 * Kaynak listesi ve lisanslar: docs/SOURCES.md
 */
import { join } from "node:path";

import { collectVanillaData } from "./bedrock-samples.ts";
import { collectMojangSchemas } from "./schemas-mojang.ts";
import { BLOCKCEPTION_DIR, BLOCKCEPTION_REF, BLOCKCEPTION_REPO, collectBlockception } from "./schemas-blockception.ts";
import { collectReleaseNotes } from "./release-notes.ts";
import { collectScriptTypes } from "./script-types.ts";
import { runIfMain } from "./lib/cli.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import {
  BEDROCK_SAMPLES_REF,
  BEDROCK_SAMPLES_REPO,
  resolveVersion,
  toMinEngineVersion,
} from "./lib/version.ts";

const CREATOR_REPO = "MicrosoftDocs/minecraft-creator";

export async function runPipeline(): Promise<void> {
  const { version, date } = await resolveVersion();
  console.log(`sürüm ${version}${date === null ? "" : ` (${date})`}\n`);

  const vanilla = await collectVanillaData(version);
  console.log(`  vanilladata      ${vanilla.changed.length} dosya güncellendi`);

  const mojang = await collectMojangSchemas(version);
  console.log(`  mojang şemaları  ${mojang.files} dosya, ${mojang.written.length} güncellendi`);

  const blockception = await collectBlockception();
  console.log(`  blockception     ${blockception.files} şema, ${blockception.written.length} güncellendi`);

  const scriptTypes = await collectScriptTypes(version);
  console.log(`  script tipleri   ${scriptTypes.written.length} dosya güncellendi`);

  const releaseNotes = await collectReleaseNotes(version);
  console.log(`  sürüm notları    ${releaseNotes.path === null ? "yok" : releaseNotes.path}`);

  // Aşama 2'nin sürüm çözümlemesi tek dosyadan okuyacak: neyin nerede olduğu,
  // hangi modül sürümüne kilitlendiği ve kaç dosya beklendiği burada.
  const index = {
    version,
    minEngineVersion: toMinEngineVersion(version),
    releaseDate: date,
    counts: vanilla.counts,
    sources: {
      bedrockSamples: { repo: BEDROCK_SAMPLES_REPO, ref: BEDROCK_SAMPLES_REF },
      mojangSchemas: { path: "schemas", index: "schemas-index.json", files: mojang.files },
      blockception: {
        repo: BLOCKCEPTION_REPO,
        ref: BLOCKCEPTION_REF,
        // data/ köküne göreli: kaynak sürüme bağlı değil, tek kopya tutulur.
        path: `../${BLOCKCEPTION_DIR}/source`,
        files: blockception.files,
        hash: blockception.hash,
      },
      scriptTypes: { path: "script-types", modules: scriptTypes.modules },
      releaseNotes: releaseNotes.path === null ? null : { repo: CREATOR_REPO, path: releaseNotes.path },
    },
  };

  const changed = await writeIfChanged(join(DATA_DIR, version, "index.json"), toJson(index));
  console.log(`\ndata/${version}/index.json ${changed ? "güncellendi" : "değişmedi"}`);
}

runIfMain(import.meta.url, runPipeline);
