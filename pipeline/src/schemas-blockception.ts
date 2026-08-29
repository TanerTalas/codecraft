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
 * Repo iki ayrı küme yayınlıyor ve ikisi de çekiliyor:
 *
 *   source/    yazım kaynağı, 1140 dosya. Dosyalar arası $id tabanlı $ref
 *              kullanıyor ve 14'ü JSONC (yorum içeriyor).
 *   kök        GitHub Action'ın ürettiği derlenmiş çıktı, 61 dosya. Her biri
 *              tek başına yeterli: tüm $ref'ler #/definitions/... olarak içeri
 *              gömülmüş, yorum yok, draft-07. Doğrulama bunları kullanır.
 *
 * Hangi dosyanın hangi doküman tipine ait olduğunu repo kökündeki
 * vscode-settings.json söylüyor (glob -> şema). O eşleme burada
 * schema-map.json'a çevriliyor; kendi eşlememizi yazmıyoruz
 * (CLAUDE.md, "kendi JSON şemalarını yazma").
 *
 * Lisans BSD-3-Clause: yeniden dağıtım serbest, ama telif bildirimi korunmalı —
 * LICENSE dosyası şemalarla birlikte kopyalanıyor.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { downloadTarball } from "./lib/github.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { hashTree, toJson, writeTree } from "./lib/fs.ts";

export const BLOCKCEPTION_REPO = "Blockception/Minecraft-bedrock-json-schemas";
export const BLOCKCEPTION_REF = "main";

/** data/ köküne göreli. index.json bu yolu yazar, validator oradan okur. */
export const BLOCKCEPTION_DIR = "blockception";

/** Derlenmiş şemalar bu alt klasöre yazılır. source/ ile karışmasın. */
export const COMPILED_SUBDIR = "compiled";

/** Üretilen tip haritası. Doğrulama tip -> şema çözümlemesini buradan yapar. */
export const SCHEMA_MAP_FILE = "schema-map.json";

/** Upstream'in eşleme dosyası. Yol değişirse pipeline durur, tahmin edilmez. */
const SETTINGS_FILE = "vscode-settings.json";

const RAW_BASE = `https://raw.githubusercontent.com/${BLOCKCEPTION_REPO}/${BLOCKCEPTION_REF}/`;

/** schema-map.json'daki tek kayıt. Yollar data/blockception/ köküne göreli. */
export type SchemaMapEntry = {
  /** Kanonik doküman tipi: derlenmiş dosyanın yolu, .json uzantısı olmadan. */
  type: string;
  schema: string;
  /** VS Code fileMatch glob'ları, upstream'den olduğu gibi. */
  fileMatch: string[];
};

type VscodeSettings = { "json.schemas"?: { fileMatch?: string[]; url?: string }[] };

export type SchemaMapResult = {
  entries: SchemaMapEntry[];
  /** Eşlemede adı geçen ama derlenmiş çıktıda bulunmayan şemalar. */
  missing: string[];
};

/**
 * vscode-settings.json -> tip haritası.
 *
 * Her url mutlaka RAW_BASE ile başlamalı; başlamıyorsa upstream düzenini
 * değiştirmiş demektir ve durulur (CLAUDE.md, "Takıldığında dur ve sor").
 *
 * Adreslenen dosyanın arşivde olmaması ise durma sebebi değil, çünkü upstream'de
 * gerçekten oluyor: 30-08-2026'da resource/cubemaps/cubemaps.json source/ altında
 * var ama derlenmiş çıktıda yok (raw URL 404 veriyor) — derleme adımı o şema için
 * henüz koşmamış. Tek bir sarkan kayıt için günlük cron'u durdurmak yanlış olurdu.
 * Atlanan kayıtlar sessizce yutulmuyor: listesi çağırana döner, index.json'a
 * yazılır ve sayı büyürse günlük diff'te görünür.
 */
export function buildSchemaMap(archive: ReadonlyMap<string, Buffer>): SchemaMapResult {
  const raw = archive.get(SETTINGS_FILE);
  if (raw === undefined) {
    throw new Error(`${BLOCKCEPTION_REPO}: ${SETTINGS_FILE} bulunamadı — tip haritası kurulamaz`);
  }

  const settings = JSON.parse(raw.toString("utf8")) as VscodeSettings;
  const entries = settings["json.schemas"];
  if (entries === undefined || entries.length === 0) {
    throw new Error(`${SETTINGS_FILE}: "json.schemas" listesi boş veya yok`);
  }

  const byType = new Map<string, SchemaMapEntry>();
  const missing: string[] = [];
  for (const entry of entries) {
    const { url, fileMatch } = entry;
    if (url === undefined || fileMatch === undefined || fileMatch.length === 0) {
      throw new Error(`${SETTINGS_FILE}: url veya fileMatch alanı eksik bir kayıt var`);
    }
    if (!url.startsWith(RAW_BASE)) {
      throw new Error(`${SETTINGS_FILE}: beklenmeyen url tabanı — ${url}`);
    }

    const path = url.slice(RAW_BASE.length);
    if (!archive.has(path)) {
      missing.push(path);
      continue;
    }

    const type = path.replace(/\.json$/, "");
    const existing = byType.get(type);
    if (existing === undefined) {
      byType.set(type, { type, schema: `${COMPILED_SUBDIR}/${path}`, fileMatch: [...fileMatch] });
    } else {
      // Aynı şemayı birden fazla kayıt adresliyorsa glob'lar birleştirilir.
      existing.fileMatch.push(...fileMatch);
    }
  }

  if (byType.size === 0) {
    throw new Error(`${SETTINGS_FILE}: hiçbir şema çözümlenemedi — derlenmiş çıktı yok`);
  }

  const result = [...byType.values()]
    .map((entry) => ({ ...entry, fileMatch: [...new Set(entry.fileMatch)].sort() }))
    .sort((a, b) => a.type.localeCompare(b.type, "en"));

  return { entries: result, missing: missing.sort() };
}

export type BlockceptionResult = {
  /** source/ altındaki şema sayısı. LICENSE bu sayıya girmez — index.json'daki
   *  `path` source/ klasörünü gösteriyor, sayım onunla aynı şeyi ölçmeli. */
  files: number;
  /** Derlenmiş, tek başına yeterli şema sayısı. Doğrulamanın kullandığı küme. */
  compiled: number;
  /** Eşlemede adı geçip derlenmiş çıktıda bulunmayanlar. Upstream eksiği. */
  missing: string[];
  written: string[];
  deleted: string[];
  /** data/blockception/ altına kopyalanan her şeyin içerik özeti. */
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

  const { entries: schemaMap, missing } = buildSchemaMap(archive);
  for (const entry of schemaMap) {
    const path = entry.schema.slice(COMPILED_SUBDIR.length + 1);
    files.set(entry.schema, archive.get(path) as Buffer);
  }
  // Üretilmiş dosya, ama writeTree klasörü verilen kümeyle eşitliyor: haritayı
  // buraya koymazsak her koşuda silinir.
  files.set(SCHEMA_MAP_FILE, Buffer.from(toJson(schemaMap), "utf8"));

  const { written, deleted } = await writeTree(join(DATA_DIR, BLOCKCEPTION_DIR), files);
  const schemas = [...files.keys()].filter((path) => path.startsWith("source/")).length;
  return {
    files: schemas,
    compiled: schemaMap.length,
    missing,
    written,
    deleted,
    hash: hashTree(files),
  };
}

runIfMain(import.meta.url, async () => {
  const result = await collectBlockception();
  console.log(
    `blockception -> data/${BLOCKCEPTION_DIR}/ — ${result.files} kaynak şema, ` +
      `${result.compiled} derlenmiş şema, ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
  for (const path of result.missing) {
    console.warn(`  uyarı: eşleme "${path}" diyor, derlenmiş çıktıda yok (upstream eksiği)`);
  }
});
