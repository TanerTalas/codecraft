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
import { COMMANDS_FILE, collectCommands } from "./commands.ts";
import { collectMojangSchemas } from "./schemas-mojang.ts";
import {
  BLOCKCEPTION_DIR,
  BLOCKCEPTION_REF,
  BLOCKCEPTION_REPO,
  COMPILED_SUBDIR,
  SCHEMA_MAP_FILE,
  collectBlockception,
} from "./schemas-blockception.ts";
import { collectReleaseNotes } from "./release-notes.ts";
import { collectScriptTypes } from "./script-types.ts";
import { TEXTURES_FILE, collectTextures } from "./textures.ts";
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

  const commands = await collectCommands(version);
  console.log(
    `  komutlar         ${commands.commands} komut, ${commands.overloads} aşırı yükleme, ` +
      `${commands.enums} enum`,
  );

  const mojang = await collectMojangSchemas(version);
  console.log(`  mojang şemaları  ${mojang.files} dosya, ${mojang.written.length} güncellendi`);

  const blockception = await collectBlockception();
  console.log(
    `  blockception     ${blockception.files} kaynak + ${blockception.compiled} derlenmiş şema, ` +
      `${blockception.written.length} güncellendi`,
  );

  const scriptTypes = await collectScriptTypes(version);
  console.log(`  script tipleri   ${scriptTypes.written.length} dosya güncellendi`);

  const textures = await collectTextures(version);
  console.log(
    `  doku anahtarları ${textures.counts.item} item, ${textures.counts.terrain} terrain`,
  );

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
      commands: {
        file: COMMANDS_FILE,
        commands: commands.commands,
        overloads: commands.overloads,
        enums: commands.enums,
        // Enum tablosunda karşılığı olmayan tipler. Doğrulayıcının elle
        // ayrıştırdığı küme bu; Mojang yeni bir tip eklerse burada görünür.
        structuralTypes: commands.structuralTypes,
      },
      blockception: {
        repo: BLOCKCEPTION_REPO,
        ref: BLOCKCEPTION_REF,
        // data/ köküne göreli: kaynak sürüme bağlı değil, tek kopya tutulur.
        path: `../${BLOCKCEPTION_DIR}/source`,
        files: blockception.files,
        // Doğrulamanın kullandığı küme: tek başına yeterli, derlenmiş şemalar
        // ve upstream'in glob eşlemesinden türetilen tip haritası.
        compiled: {
          path: `../${BLOCKCEPTION_DIR}/${COMPILED_SUBDIR}`,
          map: `../${BLOCKCEPTION_DIR}/${SCHEMA_MAP_FILE}`,
          files: blockception.compiled,
          // Eşlemede adı geçip derlenmiş çıktıda olmayanlar. Boş olması beklenir;
          // dolduğunda günlük diff'te görünür (docs/SOURCES.md).
          missing: blockception.missing,
        },
        hash: blockception.hash,
      },
      scriptTypes: { path: "script-types", modules: scriptTypes.modules },
      // minecraft:icon ve material_instances yalnızca var olan bir vanilla
      // anahtarına işaret edebilir — kaynak paketi üretilmiyor
      // (docs/VALIDATION-LIMITS.md C).
      textures: { file: TEXTURES_FILE, item: textures.counts.item, terrain: textures.counts.terrain },
      releaseNotes: releaseNotes.path === null ? null : { repo: CREATOR_REPO, path: releaseNotes.path },
    },
  };

  const changed = await writeIfChanged(join(DATA_DIR, version, "index.json"), toJson(index));
  console.log(`\ndata/${version}/index.json ${changed ? "güncellendi" : "değişmedi"}`);
}

runIfMain(import.meta.url, runPipeline);
