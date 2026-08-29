/**
 * GitHub'dan dosya çekmenin iki yolu. Hangisinin kullanılacağı repo boyutuna bağlı:
 *
 * - `downloadPaths`: dosya başına bir istek. Büyük repolarda tek yol —
 *   bedrock-samples 358 MB, tarball'ını her gün indirmek anlamsız.
 * - `downloadTarball`: tek istek. Küçük repolarda tercih edilir —
 *   Blockception 8 MB, 1140 dosyayı tek tek istemek gereksiz.
 */
import { fetchBytes, fetchJson, fetchText, mapLimit } from "./fetch.ts";
import { extractTarGz } from "./tar.ts";

const CONCURRENCY = 10;

export type TreeEntry = { path: string; type: string; size?: number };

/** Repo ağacını tek istekte verir. CI'da GITHUB_TOKEN varsa kota için kullanılır. */
export async function fetchTree(repo: string, ref: string): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`;
  const tree = await fetchJson<{ tree?: TreeEntry[]; truncated?: boolean }>(url);
  if (tree.truncated === true) {
    throw new Error(`${repo}@${ref}: ağaç yanıtı kırpılmış, dosya listesi eksik olur`);
  }
  if (tree.tree === undefined) throw new Error(`${repo}@${ref}: ağaç yanıtında "tree" alanı yok`);
  return tree.tree;
}

/** Verilen yolları raw.githubusercontent.com üzerinden indirir. */
export async function downloadPaths(
  repo: string,
  ref: string,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const base = `https://raw.githubusercontent.com/${repo}/${ref}`;
  const contents = await mapLimit(paths, CONCURRENCY, (path) =>
    fetchText(`${base}/${path.split("/").map(encodeURIComponent).join("/")}`),
  );
  return new Map(paths.map((path, i) => [path, contents[i] as string]));
}

/**
 * Repo tarball'ını indirip açar. Arşivin kökündeki `<repo>-<sha>/` katmanı atılır,
 * yani anahtarlar repo köküne göreli yollardır.
 */
export async function downloadTarball(repo: string, ref: string): Promise<Map<string, Buffer>> {
  const archive = await fetchBytes(`https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`);
  const out = new Map<string, Buffer>();
  for (const [path, content] of extractTarGz(archive)) {
    const stripped = path.slice(path.indexOf("/") + 1);
    if (stripped !== "" && path.includes("/")) out.set(stripped, content);
  }
  if (out.size === 0) throw new Error(`${repo}@${ref}: tarball boş çıktı`);
  return out;
}
