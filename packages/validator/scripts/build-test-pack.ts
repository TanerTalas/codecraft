/**
 * Ölçüm aracı — ürün kodu değil.
 *
 * Fixture'lardan Bedrock'ta yüklenebilir bir davranış paketi üretir. Amaç
 * TODO.md'de "henüz koşmamış yol" diye duran tek şeyi koşturmak: şemanın kabul
 * ettiği içeriği oyunun da kabul edip etmediğini görmek.
 *
 *   npm run fixtures:pack              test-worlds/ altına üretir
 *   npm run fixtures:pack -- --install ayrıca oyunun geliştirme klasörüne kopyalar
 *
 * Kritik özellik: yazmadan önce ürettiği HER dosya kendi validateJson'ımızdan
 * geçer, biri düşerse hiçbir şey yazılmadan durulur. Böylece "oyuna giden şey
 * doğrulanmıştı" iddiası elle kurulmuş değil, tanım gereği doğru oluyor.
 *
 * Fixture'lar olduğu gibi kopyalanır, "yüklensin diye" düzeltilmez — test
 * edilen şey doğrulayıcının onayladığı içerik.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveVersion } from "@codecraft/knowledge";

import { validateJson, validateScript } from "../src/index.ts";

const FIXTURES = fileURLToPath(new URL("../test/fixtures/valid/", import.meta.url));
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const PACK_DIR = "codecraft-test-bp";
/** test-worlds/ .gitignore içinde — üretilen paket repoya girmez. */
const OUT_DIR = join(ROOT, "test-worlds", PACK_DIR);

/** Oyunun geliştirme paketi klasörü. UWP (Store) kurulumu. */
const DEV_PACKS = join(
  process.env["LOCALAPPDATA"] ?? "",
  "Packages",
  "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
  "LocalState",
  "games",
  "com.mojang",
  "development_behavior_packs",
);

/** Fixture -> paket içindeki yol + doğrulanacağı doküman tipi. */
const FILES: { fixture: string; target: string; type: string }[] = [
  { fixture: "block-ruby-ore.json", target: "blocks/ruby_ore.json", type: "behavior/blocks" },
  { fixture: "item-ruby.json", target: "items/ruby.json", type: "behavior/items" },
  { fixture: "entity-guard.json", target: "entities/guard.json", type: "behavior/entities" },
  { fixture: "recipe-ruby-block.json", target: "recipes/ruby_block.json", type: "behavior/recipes" },
  {
    fixture: "spawn-rules-guard.json",
    target: "spawn_rules/guard.json",
    type: "behavior/spawn_rules",
  },
  {
    fixture: "animation-controller-guard.json",
    target: "animation_controllers/guard.json",
    type: "behavior/animation_controllers/animation_controller",
  },
  { fixture: "dialogue-merchant.json", target: "dialogue/merchant.json", type: "behavior/dialogue" },
  {
    fixture: "feature-rules-ruby-ore.json",
    target: "feature_rules/ruby_ore.json",
    type: "behavior/feature_rules",
  },
];

/** Script modülünün kendi UUID'si olmalı — paketin ve veri modülünün UUID'sinden farklı. */
const SCRIPT_MODULE_UUID = "5a71e3d6-8c94-4f02-b1a7-6d38e9c04f57";
const ENTRY = "scripts/main.js";

/**
 * Oyunda çalıştığı görülebilsin diye sohbete yazar. Önce validateScript'ten
 * geçer: API yanlışsa oyunda değil, burada patlar.
 */
const SCRIPT = [
  'import { world } from "@minecraft/server";',
  "",
  "world.afterEvents.worldLoad.subscribe(() => {",
  '  world.sendMessage("CodeCraft test paketi yüklendi");',
  "});",
  "",
  "world.afterEvents.playerBreakBlock.subscribe((event) => {",
  "  const id = event.brokenBlockPermutation.type.id;",
  '  world.sendMessage(event.player.name + " kırdı: " + id);',
  "});",
  "",
].join("\n");

type Manifest = {
  format_version: number;
  header: Record<string, unknown>;
  modules: Record<string, unknown>[];
  dependencies?: Record<string, unknown>[];
};

/**
 * Fixture manifest'i + script modülü. Modül sürümü koda gömülmüyor,
 * data/<sürüm>/index.json'dan okunuyor (CLAUDE.md).
 */
async function buildManifest(serverVersion: string): Promise<Manifest> {
  const manifest = JSON.parse(
    await readFile(join(FIXTURES, "manifest-behavior-pack.json"), "utf8"),
  ) as Manifest;

  manifest.modules.push({
    description: "CodeCraft doğrulama testi",
    type: "script",
    language: "javascript",
    uuid: SCRIPT_MODULE_UUID,
    version: [1, 0, 0],
    entry: ENTRY,
  });
  manifest.dependencies = [{ module_name: "@minecraft/server", version: serverVersion }];

  return manifest;
}

async function main(): Promise<void> {
  const install = process.argv.includes("--install");
  const { version, index } = await resolveVersion();

  const serverVersion = index.sources.scriptTypes.modules["@minecraft/server"]?.stable;
  if (serverVersion === null || serverVersion === undefined) {
    throw new Error(`data/${version}: @minecraft/server kararlı sürümü yok`);
  }

  console.log(`sürüm ${version}, @minecraft/server ${serverVersion}\n`);

  // 1. Her şeyi belleğe kur ve doğrula. Tek bir dosya düşerse hiçbir şey yazılmaz.
  const output = new Map<string, string>();
  let failed = 0;

  const manifest = await buildManifest(serverVersion);
  const manifestResult = await validateJson(manifest, "general/manifest", version);
  console.log(`  ${manifestResult.ok ? "+" : "-"} manifest.json                        general/manifest`);
  if (!manifestResult.ok) {
    failed += 1;
    for (const error of manifestResult.errors.slice(0, 4)) {
      console.log(`      ${error.path} :: ${error.message}`);
    }
  }
  output.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

  for (const { fixture, target, type } of FILES) {
    const content = await readFile(join(FIXTURES, fixture), "utf8");
    const result = await validateJson(content, type, version);
    console.log(`  ${result.ok ? "+" : "-"} ${target.padEnd(36)} ${type}`);
    if (!result.ok) {
      failed += 1;
      for (const error of result.errors.slice(0, 4)) {
        console.log(`      ${error.path} :: ${error.message}`);
      }
    }
    output.set(target, content);
  }

  const script = await validateScript(SCRIPT, { version });
  console.log(`  ${script.ok ? "+" : "-"} ${ENTRY.padEnd(36)} tsc, @minecraft/server ${serverVersion}`);
  if (!script.ok) {
    failed += 1;
    for (const error of script.errors) {
      console.log(`      ${error.line}:${error.column} ${error.code}: ${error.message}`);
    }
  }
  output.set(ENTRY, SCRIPT);

  if (failed > 0) {
    throw new Error(
      `${failed} dosya doğrulamadan geçemedi — hiçbir şey yazılmadı. ` +
        "Oyuna sadece doğrulanmış içerik gider.",
    );
  }

  // 2. Yaz. Bayat dosya kalmasın diye klasör önce siliniyor.
  await rm(OUT_DIR, { recursive: true, force: true });
  for (const [relative, content] of output) {
    const path = join(OUT_DIR, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }
  console.log(`\n${output.size} dosya -> ${OUT_DIR}`);

  if (!install) {
    console.log("\nOyuna kurmak icin: npm run fixtures:pack -- --install");
    return;
  }

  // 3. Oyunun geliştirme klasörüne kopyala.
  const target = join(DEV_PACKS, PACK_DIR);
  try {
    await cp(OUT_DIR, target, { recursive: true, force: true });
  } catch (error) {
    throw new Error(
      `Geliştirme klasörüne kopyalanamadı: ${DEV_PACKS}\n` +
        "Minecraft en az bir kez açılıp ana menüye ulaşmadıysa bu klasör oluşmaz.\n" +
        `Ayrıntı: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log(`kuruldu -> ${target}`);
  console.log("\nDünya oluştururken davranış paketleri arasında 'CodeCraft' görünmeli.");
}

await main();
