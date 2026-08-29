/**
 * Ağ erişimi. Pipeline tek koşuda binlerce dosya indiriyor, o yüzden burada
 * iki şey var: geçici hataları yutan bir yeniden deneme ve eşzamanlılık sınırı.
 */

const RETRIES = 3;
const RETRY_DELAY_MS = 500;

/** 5xx ve ağ hatası geçicidir, 4xx değildir — yeniden denemek anlamsız. */
function isRetryable(error: unknown): boolean {
  return !(error instanceof HttpError) || error.status >= 500;
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`${status} ${statusText} — ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(url: string, attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || i === RETRIES - 1) break;
      await sleep(RETRY_DELAY_MS * (i + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`istek başarısız — ${url}`);
}

async function request(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": "codecraft-pipeline" } });
  if (!res.ok) throw new HttpError(res.status, res.statusText, url);
  return res;
}

export async function fetchText(url: string): Promise<string> {
  return withRetry(url, async () => (await request(url)).text());
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

export async function fetchBytes(url: string): Promise<Buffer> {
  return withRetry(url, async () => Buffer.from(await (await request(url)).arrayBuffer()));
}

/**
 * Sırayı koruyarak eşzamanlı çalıştırır. GitHub raw'ı yormamak için sınır şart:
 * 1300 dosyayı aynı anda istemek 429 getirir.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
