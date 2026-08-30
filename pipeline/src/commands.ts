/**
 * Mojang/bedrock-samples → data/<sürüm>/commands.json
 *
 * `metadata/command_modules/mojang-commands.json` Mojang'ın **makine okunur**
 * komut tanımı: 83 komut, 270 aşırı yükleme, 1149 parametre ve 225 enum.
 *
 * Bu dosyanın varlığı `CLAUDE.md`'deki "komut sözdizimi doğrulayıcısı v1'de
 * yok" maddesinin gerekçesini geçersiz kıldı — gerekçe "makine okunur resmi
 * kaynak yok" idi, oysa kaynak zaten çektiğimiz deponun zaten kullandığımız
 * metadata/ klasöründe duruyor (30-08-2026'da bulundu).
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 * data/ altına türetilmiş, kompakt bir indeks yazılır: açıklama metinleri
 * atılır (Mojang'ın prozası birebir commit edilmez, docs/SOURCES.md'deki aynı
 * gerekçe) ve yalnızca doğrulamanın kullandığı alanlar kalır.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import { BEDROCK_SAMPLES_RAW, resolveVersion } from "./lib/version.ts";

const SOURCE_PATH = "metadata/command_modules/mojang-commands.json";
export const COMMANDS_FILE = "commands.json";

/** Kaynaktaki ham şekil. Yalnızca okuduğumuz alanlar yazılı. */
type RawParam = {
  name?: string;
  is_optional?: boolean;
  type?: { name?: string };
};

type RawOverload = { name?: string; params?: RawParam[] };

type RawCommand = {
  name?: string;
  /** Nesne dizisi, düz metin değil: `[{ "name": "tp" }]` (ölçülerek görüldü). */
  aliases?: { name?: string }[];
  overloads?: RawOverload[];
  permission_level?: number;
  requires_cheats?: boolean;
};

type RawEnum = { name?: string; values?: { value?: string }[] };

type RawModule = {
  name?: string;
  module_type?: string;
  commands?: RawCommand[];
  command_enums?: RawEnum[];
};

/** Türetilen indeksin şekli. Doğrulayıcı bunu okur. */
export type CommandParam = {
  name: string;
  /** Parametre tipi. Enum tablosunda varsa oradan, yoksa yapısal tip. */
  type: string;
  optional: boolean;
};

export type CommandOverload = { params: CommandParam[] };

export type CommandDef = {
  name: string;
  aliases: string[];
  overloads: CommandOverload[];
  permissionLevel: number;
  requiresCheats: boolean;
};

export type CommandIndex = {
  /** Komut adı -> tanım. Alias'lar ayrı anahtar değil, aliases alanında. */
  commands: Record<string, CommandDef>;
  /** Enum adı (küçük harf) -> kabul edilen değerler. */
  enums: Record<string, string[]>;
};

function requireName(value: string | undefined, what: string): string {
  if (value === undefined || value === "") {
    throw new Error(`${SOURCE_PATH}: ${what} için "name" alanı yok`);
  }
  return value;
}

/**
 * Ham modülü kompakt indekse çevirir.
 *
 * Enum adları kaynakta PascalCase (`AimAssistActionSet`), parametre tipleri
 * BÜYÜK HARF (`AIMASSISTACTIONSET`). Eşleşme küçük harfe indirgenerek
 * kuruluyor — ölçülerek bulundu, 248 tipin 225'i böyle eşleşiyor.
 */
export function toIndex(module: RawModule): CommandIndex {
  if (module.module_type !== "commands") {
    throw new Error(`${SOURCE_PATH}: module_type "${module.module_type}", "commands" bekleniyordu`);
  }

  const enums: Record<string, string[]> = {};
  for (const entry of module.command_enums ?? []) {
    const name = requireName(entry.name, "command_enums girdisi");
    const values = (entry.values ?? []).flatMap((v) =>
      typeof v.value === "string" ? [v.value] : [],
    );
    // Küçük harf anahtar: parametre tipleriyle eşleşmenin tek yolu.
    enums[name.toLowerCase()] = values.sort();
  }

  const commands: Record<string, CommandDef> = {};
  for (const entry of module.commands ?? []) {
    const name = requireName(entry.name, "commands girdisi");
    commands[name] = {
      name,
      aliases: (entry.aliases ?? [])
        .flatMap((alias) => (typeof alias.name === "string" ? [alias.name] : []))
        .sort(),
      overloads: (entry.overloads ?? []).map((overload) => ({
        params: (overload.params ?? []).map((param) => ({
          name: param.name ?? "",
          type: requireName(param.type?.name, `${name} parametresi`),
          optional: param.is_optional === true,
        })),
      })),
      permissionLevel: entry.permission_level ?? 0,
      requiresCheats: entry.requires_cheats === true,
    };
  }

  if (Object.keys(commands).length === 0) {
    throw new Error(`${SOURCE_PATH}: hiç komut çıkarılamadı`);
  }

  return { commands, enums };
}

export type CommandsResult = {
  commands: number;
  overloads: number;
  enums: number;
  /** Enum tablosunda karşılığı olmayan, elle ayrıştırılacak tipler. */
  structuralTypes: string[];
  changed: boolean;
};

/** Enum tablosunda karşılığı olmayan tipler — doğrulayıcının kapsaması gerekenler. */
export function structuralTypes(index: CommandIndex): string[] {
  const types = new Set<string>();
  for (const command of Object.values(index.commands)) {
    for (const overload of command.overloads) {
      for (const param of overload.params) {
        if (index.enums[param.type.toLowerCase()] === undefined) types.add(param.type);
      }
    }
  }
  return [...types].sort();
}

export async function collectCommands(version: string): Promise<CommandsResult> {
  const text = await fetchText(`${BEDROCK_SAMPLES_RAW}/${SOURCE_PATH}`);
  await writeIfChanged(join(RAW_DIR, "bedrock-samples", version, "mojang-commands.json"), text);

  const index = toIndex(JSON.parse(text) as RawModule);
  const changed = await writeIfChanged(
    join(DATA_DIR, version, COMMANDS_FILE),
    toJson(index),
  );

  const overloads = Object.values(index.commands).reduce(
    (sum, command) => sum + command.overloads.length,
    0,
  );

  return {
    commands: Object.keys(index.commands).length,
    overloads,
    enums: Object.keys(index.enums).length,
    structuralTypes: structuralTypes(index),
    changed,
  };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectCommands(version);
  console.log(`sürüm ${version}`);
  console.log(`  komut          ${result.commands}`);
  console.log(`  aşırı yükleme  ${result.overloads}`);
  console.log(`  enum           ${result.enums}`);
  console.log(`  yapısal tip    ${result.structuralTypes.length}`);
  console.log(`  ${result.structuralTypes.join(", ")}`);
  console.log(`\ndata/${version}/${COMMANDS_FILE} ${result.changed ? "güncellendi" : "değişmedi"}`);
});
