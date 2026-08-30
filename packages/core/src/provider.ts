/**
 * Sağlayıcı bilgisi ve yapılandırmanın ŞEKLİ. Saf: dosya okumaz.
 *
 * `config.ts`'ten ayrı durmasının sebebi ölçülmüş bir sızıntı: o dosya
 * `node:fs` ve `@codecraft/knowledge` çekiyor, `model.ts` ise ondan yalnızca
 * `requireApiKey` ve `Config` alıyordu. Tek bir değer import'u yüzünden bütün
 * dosya sistemi zinciri tarayıcı grafiğine giriyordu
 * (packages/core/test/layers.test.ts).
 *
 * Anahtar burada da hiçbir dosyadan okunmaz; çağıran ne verirse o kullanılır.
 * Node tarafında bu `process.env`, tarayıcıda kullanıcının girdiği metin.
 */
import { UserError } from "./errors.ts";

export type ProviderName = "google";

/**
 * Anahtarın okunduğu ortam.
 *
 * Node'da `process.env`, tarayıcıda kullanıcının girdiği anahtarı taşıyan düz
 * bir nesne. Tek bir imza iki ortamı da karşılıyor.
 */
export type Env = Record<string, string | undefined>;

/**
 * Ortam yoksa boş nesne.
 *
 * `process.env`'i doğrudan varsayılan yapmak paketleyicinin bir `process`
 * gölgesi enjekte etmesine bel bağlamak olurdu. `typeof` kontrolü her yerde
 * güvenli ve niyeti de açık yazıyor.
 */
export const defaultEnv = (): Env => (typeof process === "undefined" ? {} : process.env);

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

/**
 * Anahtarı ortamdan okur. Yoksa ne yapılacağını tek adımda söyler
 * (CLAUDE.md, "Nasıl sorulur").
 */
export function requireApiKey(provider: ProviderName, env: Env = defaultEnv()): string {
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
