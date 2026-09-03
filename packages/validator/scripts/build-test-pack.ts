/**
 * Ölçüm aracı — ürün kodu değil.
 *
 * Fixture'lardan Bedrock'ta yüklenebilir bir davranış paketi üretir. Amaç
 * doğrulamanın kendi kendine ölçemediği tek şeyi koşturmak: şemanın kabul
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

import { findDevPacksDir, resolveVersion } from "@codecraft/knowledge";

import {
  checkComponents,
  checkMolang,
  checkReferences,
  validateJson,
  validateScript,
} from "../src/index.ts";
import type { CheckResult, PackFile } from "../src/index.ts";

const FIXTURES = fileURLToPath(new URL("../test/fixtures/valid/", import.meta.url));
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const PACK_DIR = "codecraft-test-bp";
/** test-worlds/ .gitignore içinde — üretilen paket repoya girmez. */
const OUT_DIR = join(ROOT, "test-worlds", PACK_DIR);

/**
 * Oyunun com.mojang klasörü ve development_behavior_packs yolu
 * @codecraft/knowledge içinde çözülüyor (game-paths.ts); mantık tek yerde
 * durur.
 */

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
    // Dosya adı identifier'ın namespace'siz hâliyle aynı olmak zorunda. Oyun
    // 30-08-2026'daki ilk koşuda reddetti: "Feature rule identifier
    // 'ruby_ore_feature' does not match filename 'ruby_ore'". Hiçbir JSON şeması
    // bunu yakalayamaz — kural içerikle dosya adı arasında, şema ise sadece
    // içeriği görüyor.
    target: "feature_rules/ruby_ore_feature.json",
    type: "behavior/feature_rules",
  },
];

/**
 * ÖLÇÜM PROBE'LARI — bilerek UYARI üreten dosyalar.
 *
 * Yukarıdaki fixture'lar doğrulayıcının ONAYLADIĞI içeriği taşıyor; bunlar
 * tersini taşıyor. Sebebi `docs/VALIDATION-LIMITS.md`, "Sıradaki ölçüm":
 * A' (yol referansları), F (Molang) ve G (bileşen adları) **warning**
 * seviyesinde ve orada durmalarının tek sebebi ölçüm eksikliği — üçünün de
 * `ContentLog` kanıtı yok. Oyun şikâyet ederse sınıf error'a yükselir,
 * etmezse "warning kalması doğruymuş" diye yazılır. İki sonuç da kazanç.
 *
 * ÜÇÜ AYRI DOSYA VE AYRI KİMLİK, çünkü tek dosyada toplansalardı günlükteki
 * satır hangi sınıfa ait olurdu bilinmezdi. Böyle 1:1 eşleşiyor.
 *
 * HEPSİ GERÇEKTEN YÜKLENEN İÇERİK: iki blok tanımı ve bir entity. Yüklenmeyen
 * bir dosya için "oyun şikâyet etmedi" ile "dosya hiç okunmadı" ayırt
 * edilemezdi ve ölçüm boşa giderdi.
 */
type Probe = {
  /** docs/VALIDATION-LIMITS.md'deki sınıf harfi. */
  klass: string;
  target: string;
  type: string;
  content: unknown;
  /** Bu dosyanın tetiklemesi GEREKEN kontrol. Tetiklemezse paket yazılmaz. */
  check: (files: PackFile[]) => Promise<CheckResult>;
  /** Oyunda ContentLog'da aranacak şey. */
  lookFor: string;
};

const PROBES: Probe[] = [
  {
    klass: "F · Molang",
    target: "blocks/probe_molang.json",
    type: "behavior/blocks",
    content: {
      format_version: "1.21.100",
      "minecraft:block": {
        description: { identifier: "codecraft:probe_molang" },
        components: { "minecraft:destructible_by_mining": { seconds_to_destroy: 1 } },
        // "is_babyy" diye bir sorgu yok; doğrusu query.is_baby.
        permutations: [{ condition: "query.is_babyy", components: {} }],
      },
    },
    check: (files) => checkMolang(files),
    lookFor: "codecraft:probe_molang veya is_babyy geçen bir satır",
  },
  {
    klass: "G · Bileşen adı",
    target: "blocks/probe_component.json",
    type: "behavior/blocks",
    content: {
      format_version: "1.21.100",
      "minecraft:block": {
        description: { identifier: "codecraft:probe_component" },
        components: {
          "minecraft:destructible_by_mining": { seconds_to_destroy: 1 },
          // Doğrusu minecraft:destructible_by_mining. İki şema kaynağı da
          // bu adı geçiriyor (VALIDATION-LIMITS · G).
          "minecraft:destructable": {},
        },
      },
    },
    check: (files) => checkComponents(files),
    lookFor: "codecraft:probe_component veya destructable geçen bir satır",
  },
  {
    klass: "A' · Yol referansı",
    target: "entities/probe_loot.json",
    type: "behavior/entities",
    content: {
      format_version: "1.21.100",
      "minecraft:entity": {
        description: {
          identifier: "codecraft:probe_loot",
          is_spawnable: true,
          is_summonable: true,
        },
        components: {
          "minecraft:health": { value: 10, max: 10 },
          "minecraft:physics": {},
          // Böyle bir tablo yok ve paket de getirmiyor.
          "minecraft:loot": { table: "loot_tables/entities/codecraft_probe_missing.json" },
        },
      },
    },
    check: (files) => checkReferences(files),
    lookFor: "codecraft_probe_missing geçen bir satır — ÖLDÜRÜLDÜKTEN sonra",
  },
];

/** Script modülünün kendi UUID'si olmalı — paketin ve veri modülünün UUID'sinden farklı. */
const SCRIPT_MODULE_UUID = "5a71e3d6-8c94-4f02-b1a7-6d38e9c04f57";
const ENTRY = "scripts/main.js";

/**
 * Oyunda çalıştığı görülebilsin diye sohbete yazar. Önce validateScript'ten
 * geçer: API yanlışsa oyunda değil, burada patlar.
 *
 * worldLoad üç kanaldan birden raporluyor, çünkü ilk koşuda (30-08-2026)
 * playerBreakBlock mesajları sohbete düştü ama worldLoad mesajı hiç görünmedi
 * ve içerik günlüğünde de hata yoktu. İki ihtimal var ve tipler ayırt etmiyor:
 * olay hiç tetiklenmedi, ya da tetiklendi ama o anda mesajı alacak oyuncu yoktu.
 *
 *   console.warn  -> içerik günlüğüne yazar, oyuncuya ihtiyaç duymaz.
 *                    Satır günlükte varsa olay tetiklenmiş demektir.
 *   sendMessage   -> ilk koşudaki davranışın aynısı, karşılaştırma için duruyor.
 *   playerSpawn   -> oyuncu geldikten sonra yazar, her hâlükârda görünmeli.
 */
const SCRIPT = [
  'import { world } from "@minecraft/server";',
  "",
  "world.afterEvents.worldLoad.subscribe(() => {",
  '  console.warn("[codecraft] worldLoad tetiklendi");',
  '  world.sendMessage("CodeCraft test paketi yüklendi (worldLoad)");',
  "});",
  "",
  "world.afterEvents.playerSpawn.subscribe((event) => {",
  "  if (!event.initialSpawn) return;",
  '  console.warn("[codecraft] playerSpawn tetiklendi");',
  '  event.player.sendMessage("CodeCraft test paketi yüklendi (playerSpawn)");',
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
  // Probe'lar varsayılan olarak AÇIK: belgelenen komut ölçüm üretmezse oyun
  // oturumu boşa gider. --no-probe temiz kontrol paketini verir.
  const probe = !process.argv.includes("--no-probe");
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

  if (probe) {
    for (const item of PROBES) {
      const content = `${JSON.stringify(item.content, null, 2)}
`;

      // (1) Şemadan geçmeli. Geçmezse oyuna hiç gitmez ve sınıf ölçülemez.
      const schema = await validateJson(content, item.type, version);
      console.log(`  ${schema.ok ? "+" : "-"} ${item.target.padEnd(36)} probe ${item.klass}`);
      if (!schema.ok) {
        failed += 1;
        for (const error of schema.errors.slice(0, 4)) {
          console.log(`      ${error.path} :: ${error.message}`);
        }
      }

      // (2) Kendi kontrolünü GERÇEKTEN tetiklemeli. Kontrol grubu: bir gün
      // indeks değişip bulgu susarsa paket sessizce ölçmeyen bir paket olur.
      const fired = await item.check([{ path: item.target, content }]);
      if (fired.findings.length === 0) {
        failed += 1;
        console.log("      probe kendi kontrolünü tetiklemedi — fixture çürümüş");
      }

      output.set(item.target, content);
    }
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
  const devPacks = await findDevPacksDir();
  const target = join(devPacks, PACK_DIR);
  await mkdir(devPacks, { recursive: true });
  // Bayat dosya kalmasın: kopyalamadan önce eski kurulum siliniyor.
  await rm(target, { recursive: true, force: true });
  await cp(OUT_DIR, target, { recursive: true });
  console.log(`kuruldu -> ${target}`);
  console.log("\nDünya oluştururken davranış paketleri arasında 'CodeCraft' görünmeli.");

  if (!probe) return;

  console.log(
    [
      "",
      "ÖLÇÜM — üç sınıf oyunda hiç denenmedi (docs/VALIDATION-LIMITS.md).",
      "Ayarlar > Yaratıcı > 'Content Log File' AÇIK olmalı, sonra:",
      "  %APPDATA%\\Minecraft Bedrock\\logs\\ContentLog*.txt",
      "",
      ...PROBES.map((item) => `  ${item.klass.padEnd(18)} ${item.lookFor}`),
      "",
      "A' için dünyada bir adım daha gerekiyor: tablo ölüm anında çözülüyor.",
      "  /summon codecraft:probe_loot   sonra öldür",
      "",
      "Satır çıkarsa sınıf error'a yükselir, çıkmazsa 'warning doğruymuş'",
      "diye yazılır. İkisi de sonuç; yazılmayan tek şey ölçülmemiş olan.",
    ].join("\n"),
  );
}

await main();
