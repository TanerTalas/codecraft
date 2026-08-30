/**
 * Model yapılandırması.
 *
 * Model ID'si koda gömülmüyor (CLAUDE.md, "Yapılmayacaklar"): ekosistem sık
 * değişiyor ve yanlış hatırlanan bir model adı sessizce çalışmayan bir çağrı
 * üretir — bu aracın var olma sebebiyle aynı hata.
 *
 * Anahtar bu dosyadan hiç okunmaz. Yalnızca ortam değişkeninden gelir, hiçbir
 * log satırına, rapora veya hata mesajına yazılmaz.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ROOT } from "@codecraft/knowledge";

import { UserError } from "./errors.ts";

/**
 * Yerel ortam dosyaları. İlk bulunan okunur.
 *
 * `.gitignore` zaten `.env.*` kalıbını tutuyor, yani anahtar git'e girmez.
 * Node 24 `loadEnvFile`'ı yerleşik veriyor — `dotenv` gibi bir bağımlılık
 * eklenmiyor.
 */
const ENV_FILES = [".env.local", ".env"];

/**
 * Varsa yerel ortam dosyasını `process.env`'e yükler.
 *
 * Zaten tanımlı bir değişkenin üstüne **yazmaz**: kabuğa `setx` ile yazılmış
 * bir anahtar dosyadakinden önce gelir. Aksi hâlde iki kaynak varken hangisinin
 * geçerli olduğu belirsiz kalır ve "neden eski anahtarı kullanıyor" türünden
 * bir hata ayıklama turu doğar.
 */
export function loadEnvFiles(root: string = ROOT): void {
  for (const name of ENV_FILES) {
    const path = join(root, name);
    if (!existsSync(path)) continue;

    const existing = new Map(Object.entries(process.env));
    process.loadEnvFile(path);
    for (const [key, value] of existing) process.env[key] = value;
    return;
  }
}

export const CONFIG_FILE = "codecraft.config.json";
export const LOCAL_CONFIG_FILE = "codecraft.config.local.json";

export type ProviderName = "google";

/** Sağlayıcı adı -> anahtarın okunduğu ortam değişkeni. */
export const API_KEY_ENV: Record<ProviderName, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

export type Config = {
  provider: ProviderName;
  /** Sağlayıcının model kimliği. --models ile listelenir, elle yazılmaz. */
  model: string;
  maxOutputTokens: number;
  temperature: number;
  /**
   * Taşıma katmanı yeniden denemesi (429, 5xx). AI SDK'ya geçer; SDK üstel
   * geri çekilmeyi ve Retry-After başlığını kendisi uyguluyor, o yüzden burada
   * ikinci bir backoff yazılmıyor.
   *
   * Üretim döngüsündeki kalite retry'ıyla karıştırılmamalı: o hatayı modele
   * geri veren ayrı bir denemedir ve sayısı sabit birdir (TODO.md Aşama 3).
   */
  maxRetries: number;
  /**
   * İki model isteği arasındaki en az süre (ms).
   *
   * VAKA başına değil İSTEK başına uygulanır — sağlayıcının sınırı da öyle.
   *
   * Ölçüldü (30-08-2026, AI Studio kota panosu, Gemini ücretsiz kademe):
   * dakikada **5** istek, günde **20** istek, model başına.
   *
   * Dakikalık sınır önce yanlış okundu (API hata metnindeki "limit: 20" günlük
   * sınırdı, dakikalık değil) ve 4000 ms yazılmıştı — dakikada 15 istek, yani
   * tavanın üç katı. 13000 ms dakikada ~4,6 istek demek, 5'in altında pay
   * bırakıyor.
   */
  requestDelayMs: number;
};

const DEFAULTS: Omit<Config, "model"> = {
  provider: "google",
  maxOutputTokens: 8192,
  temperature: 0,
  maxRetries: 3,
  requestDelayMs: 13000,
};

/** Yapılandırmada durmaması gereken alan adları. */
const SECRET_KEY_RE = /(^|[^a-z])api[_-]?key|(^|[^a-z])(auth|access|bearer)[_-]?token|secret|password|credential/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function readJsonIfExists(path: string): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} ayrıştırılamadı: ${(error as Error).message}`);
  }
  if (!isObject(parsed)) throw new Error(`${path} bir JSON nesnesi olmalı`);
  return parsed;
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${CONFIG_FILE}: "${key}" alanı boş olmayan bir metin olmalı`);
  }
  return value;
}

function optionalNumber(raw: Record<string, unknown>, key: string, fallback: number): number {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${CONFIG_FILE}: "${key}" negatif olmayan bir sayı olmalı`);
  }
  return value;
}

/**
 * codecraft.config.json + isteğe bağlı codecraft.config.local.json.
 * Yerel dosya üstüne yazar ve git'e girmez.
 */
export async function loadConfig(root: string = ROOT): Promise<Config> {
  // Yerel kurulumu okumak ile yapılandırmayı okumak aynı adım. Anahtarın
  // kendisi hâlâ yalnızca process.env'den alınıyor, yapılandırmadan değil.
  loadEnvFiles(root);

  const base = await readJsonIfExists(join(root, CONFIG_FILE));
  if (base === null) {
    throw new UserError(
      `${CONFIG_FILE} bulunamadı (${root}). Örnek için depodaki dosyaya bak; ` +
        "model kimliğini `npm run codecraft -- --models` ile listeleyip yaz.",
    );
  }
  const local = await readJsonIfExists(join(root, LOCAL_CONFIG_FILE));
  const raw = { ...base, ...(local ?? {}) };

  // Anahtar yapılandırmaya sızmasın: yanlışlıkla yazılmışsa sessizce yok
  // sayılmaz, çünkü o dosya commit ediliyor.
  //
  // Kalıp dar tutuldu: düz "token" araması maxOutputTokens gibi meşru alanlara
  // takılıyordu (testte yakalandı). Aranan şey sır adı, sır kelimesi değil.
  for (const key of Object.keys(raw)) {
    if (SECRET_KEY_RE.test(key)) {
      throw new UserError(
        `${CONFIG_FILE}: "${key}" alanı burada duramaz. Anahtar yalnızca ortam ` +
          "değişkeninden okunur ve bu dosya commit ediliyor.",
      );
    }
  }

  const provider = (raw["provider"] ?? DEFAULTS.provider) as string;
  if (!(provider in API_KEY_ENV)) {
    throw new UserError(
      `${CONFIG_FILE}: bilinmeyen sağlayıcı "${provider}". ` +
        `Tanınanlar: ${Object.keys(API_KEY_ENV).join(", ")}`,
    );
  }

  return {
    provider: provider as ProviderName,
    model: requireString(raw, "model"),
    maxOutputTokens: optionalNumber(raw, "maxOutputTokens", DEFAULTS.maxOutputTokens),
    temperature: optionalNumber(raw, "temperature", DEFAULTS.temperature),
    maxRetries: optionalNumber(raw, "maxRetries", DEFAULTS.maxRetries),
    requestDelayMs: optionalNumber(raw, "requestDelayMs", DEFAULTS.requestDelayMs),
  };
}

/**
 * Anahtarı ortamdan okur. Yoksa ne yapılacağını tek adımda söyler
 * (CLAUDE.md, "Nasıl sorulur").
 */
export function requireApiKey(provider: ProviderName, env = process.env): string {
  const name = API_KEY_ENV[provider];
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new UserError(
      `${name} tanımlı değil. Google AI Studio'dan (aistudio.google.com) ` +
        `ücretsiz bir anahtar alıp şunu çalıştır:\n` +
        `  setx ${name} "..."\n` +
        "Yeni bir terminal açman gerekir. Anahtar hiçbir dosyaya yazılmaz.",
    );
  }
  return value;
}
