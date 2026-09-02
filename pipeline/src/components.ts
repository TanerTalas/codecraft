/**
 * Mojang/bedrock-samples → data/<sürüm>/components.json + event-order.json
 *
 * `metadata/doc_modules/` Mojang'ın kendi dokümantasyonu, ama **hepsi makine
 * okunur değil.** Ölçüldü (02-09-2026, 20 dosyanın hepsi ayrıştırıldı):
 *
 * | Dosya | Düğüm | `minecraft:` adlı | Kullanılabilir mi |
 * |---|---|---|---|
 * | `entities.json` | 5068 | 708 | **evet** |
 * | `blocks.json` | 186 | 39 | **evet** |
 * | `features.json` | 81 | 29 | **evet** |
 * | `biomes.json` | 154 | 43 | **evet** |
 * | `client-biomes.json` | 73 | 29 | **evet** |
 * | `particles.json` | 103 | 22 | **hayır** — adlar `minecraft:example_*`, örnek |
 * | `molang.json` | 502 | 0 | hayır — düz prosa |
 * | `entity-events.json` | 10 | 0 | hayır — düz prosa |
 * | `animations`, `fogs`, `schemas`, `texture-sets` | <40 | 0 | hayır |
 *
 * "20 doküman modülü indekslenir" cümlesi bu yüzden yanlış olurdu. Beşi
 * alınıyor, `particles.json` bilerek alınmıyor: içindeki `minecraft:` adlar
 * gerçek parçacık değil dokümantasyon örneği ve indekse girseydi uydurma
 * kimlikleri "geçerli" sayardık.
 *
 * BÖLÜM ADLARI ELLE YAZILI ve bu bilinçli. Ağacın tamamından `minecraft:`
 * adları toplamak daha kısa olurdu ama anlamı bozardı: `entities.json`
 * içinde AI hedefleri, öznitelikler, bileşenler ve olaylar AYRI bölümlerde ve
 * hepsi aynı önekle başlıyor. Hepsini "bileşen" saymak, olay adını bileşen
 * yerine yazan bir dosyayı geçirirdi.
 *
 * Bölüm bulunamazsa pipeline DURUR — upstream başlığı değiştirmişse sessizce
 * boş indeks yazmak, doğrulamayı sessizce kapatmak demek.
 *
 * Ayrıca `metadata/engine_modules/engine-after-events-ordering.json` okunuyor:
 * modül sürümü başına afterEvent sırası. Bu dosya tek başına ve tartışmasız
 * makine okunur.
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { downloadPaths } from "./lib/github.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import {
  BEDROCK_SAMPLES_RAW,
  BEDROCK_SAMPLES_REF,
  BEDROCK_SAMPLES_REPO,
  resolveVersion,
} from "./lib/version.ts";

const DOCS_PREFIX = "metadata/doc_modules/";
const EVENTS_PATH = "metadata/engine_modules/engine-after-events-ordering.json";

export const COMPONENTS_FILE = "components.json";
export const EVENT_ORDER_FILE = "event-order.json";

type DocNode = { name?: string; type?: string; nodes?: DocNode[] };
type DocModule = { name?: string; nodes?: DocNode[] };

/**
 * Hangi dosyanın hangi bölümünden ne çıkarılıyor.
 *
 * `section` başlık zinciri: ["Blocks", "Block Components"] → önce "Blocks"
 * düğümü bulunur, altında "Block Components" aranır, onun DOĞRUDAN
 * çocuklarından `minecraft:` ile başlayanlar alınır.
 */
const SECTIONS = [
  { file: "blocks", key: "blockComponents", section: ["Blocks", "Block Components"] },
  { file: "blocks", key: "blockTriggers", section: ["Blocks", "Block Trigger Components"] },
  {
    file: "entities",
    key: "entityComponents",
    section: ["Server Entity Documentation", "Components"],
  },
  { file: "entities", key: "entityGoals", section: ["Server Entity Documentation", "AI Goals"] },
  {
    file: "entities",
    key: "entityAttributes",
    section: ["Server Entity Documentation", "Attributes"],
  },
  {
    file: "entities",
    key: "entityProperties",
    section: ["Server Entity Documentation", "Properties"],
  },
  {
    file: "entities",
    key: "entityEvents",
    section: ["Server Entity Documentation", "Built-in Events"],
  },
  { file: "features", key: "featureTypes", section: ["Supported features"] },
  { file: "biomes", key: "biomeComponents", section: ["Schema"] },
  { file: "client-biomes", key: "clientBiomeComponents", section: ["Schema"] },
] as const;

export type ComponentKey = (typeof SECTIONS)[number]["key"];
export type ComponentIndex = Record<ComponentKey, string[]>;

/** Başlık zincirini izleyerek düğümü bulur. Bulunamazsa null. */
function findSection(nodes: readonly DocNode[], chain: readonly string[]): DocNode | null {
  let current: readonly DocNode[] = nodes;
  let found: DocNode | null = null;
  for (const name of chain) {
    found = current.find((node) => node.name === name) ?? null;
    if (found === null) return null;
    current = found.nodes ?? [];
  }
  return found;
}

/** Bölümün doğrudan çocuklarından `minecraft:` adlı olanlar. */
function namesUnder(section: DocNode): string[] {
  return (section.nodes ?? [])
    .flatMap((node) => (node.name?.startsWith("minecraft:") === true ? [node.name] : []))
    .sort();
}

type RawEventOrder = {
  after_events_order_by_version?: { version?: string; event_order?: { name?: string }[] }[];
};

/** Modül sürümü → o sürümdeki afterEvent sırası. */
export type EventOrderIndex = Record<string, string[]>;

export type ComponentsResult = {
  counts: Record<string, number>;
  eventVersions: number;
  changed: string[];
};

export async function collectComponents(version: string): Promise<ComponentsResult> {
  const rawDir = join(RAW_DIR, "bedrock-samples", version, "doc_modules");
  const outDir = join(DATA_DIR, version);
  const changed: string[] = [];

  const wanted = [...new Set(SECTIONS.map((entry) => entry.file))];
  const downloaded = await downloadPaths(
    BEDROCK_SAMPLES_REPO,
    BEDROCK_SAMPLES_REF,
    wanted.map((name) => `${DOCS_PREFIX}${name}.json`),
  );

  const parsed = new Map<string, DocModule>();
  for (const [path, content] of downloaded) {
    const name = path.slice(DOCS_PREFIX.length).replace(/\.json$/, "");
    await writeIfChanged(join(rawDir, `${name}.json`), content);
    parsed.set(name, JSON.parse(content) as DocModule);
  }

  const index = {} as ComponentIndex;
  const counts: Record<string, number> = {};

  for (const { file, key, section } of SECTIONS) {
    const module = parsed.get(file);
    if (module === undefined) throw new Error(`${DOCS_PREFIX}${file}.json indirilemedi`);

    const node = findSection(module.nodes ?? [], section);
    if (node === null) {
      throw new Error(
        `${file}.json: "${section.join(" → ")}" bölümü yok — upstream başlığı değiştirmiş olabilir. ` +
          "Sessizce boş indeks yazmak doğrulamayı sessizce kapatmak olurdu.",
      );
    }

    const names = namesUnder(node);
    if (names.length === 0) {
      throw new Error(`${file}.json: "${section.join(" → ")}" altında minecraft: adlı düğüm yok`);
    }
    index[key] = names;
    counts[key] = names.length;
  }

  if (await writeIfChanged(join(outDir, COMPONENTS_FILE), toJson(index))) {
    changed.push(COMPONENTS_FILE);
  }

  // --- afterEvent sırası ---
  const eventsText = await fetchText(`${BEDROCK_SAMPLES_RAW}/${EVENTS_PATH}`);
  await writeIfChanged(join(RAW_DIR, "bedrock-samples", version, "engine-after-events-ordering.json"), eventsText);

  const rawEvents = JSON.parse(eventsText) as RawEventOrder;
  const eventOrder: EventOrderIndex = {};
  for (const entry of rawEvents.after_events_order_by_version ?? []) {
    if (entry.version === undefined) continue;
    eventOrder[entry.version] = (entry.event_order ?? []).flatMap((event) =>
      typeof event.name === "string" ? [event.name] : [],
    );
  }
  if (Object.keys(eventOrder).length === 0) {
    throw new Error(`${EVENTS_PATH}: sürüm kaydı yok — biçim değişmiş olabilir`);
  }

  if (await writeIfChanged(join(outDir, EVENT_ORDER_FILE), toJson(eventOrder))) {
    changed.push(EVENT_ORDER_FILE);
  }

  return { counts, eventVersions: Object.keys(eventOrder).length, changed };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectComponents(version);
  for (const [key, count] of Object.entries(result.counts)) {
    console.log(`  ${key.padEnd(22)} ${count}`);
  }
  console.log(`  afterEvent sürümü      ${result.eventVersions}`);
  console.log(`\ndata/${version}/ — ${result.changed.length} dosya güncellendi`);
});
