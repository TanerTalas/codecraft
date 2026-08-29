/** Repo içindeki sabit yollar. Tek yerden çözülür ki script'ler taşınınca kırılmasın. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo kökü. Bu dosya pipeline/src/lib/ altında, üç seviye yukarı. */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Ham kaynak kopyası. .gitignore içinde — Minecraft EULA (docs/SOURCES.md). */
export const RAW_DIR = join(ROOT, "pipeline", "raw");

/** Türetilen indeksler. Git içinde durur (CLAUDE.md, mimari kural 4). */
export const DATA_DIR = join(ROOT, "data");
