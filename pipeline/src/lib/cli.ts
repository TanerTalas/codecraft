/** Her toplayıcı hem tek başına hem orkestratörün içinden koşabilsin diye. */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}

/** Doğrudan çalıştırıldıysa fn'i koşar, hatayı tek satırda basıp exit 1 yapar. */
export function runIfMain(moduleUrl: string, fn: () => Promise<void>): void {
  if (!isMain(moduleUrl)) return;
  fn().catch((error: unknown) => {
    console.error(`pipeline hatası: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
