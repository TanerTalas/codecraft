/**
 * data/ klasörünün yeri. Tek yerden çözülür ki paket taşınınca kırılmasın.
 *
 * data/ git içinde durur ve veritabanı yoktur (CLAUDE.md, mimari kural 4) —
 * bu yüzden repo köküne göre sabit bir yol yeterli.
 */
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** Repo kökü. Bu dosya packages/knowledge/src/ altında, üç seviye yukarı. */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export const DATA_DIR = join(ROOT, "data");
