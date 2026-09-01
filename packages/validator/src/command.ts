/**
 * Komut sözdizimi doğrulama — Mojang'ın kendi komut tanımına karşı.
 * Saf fonksiyon, model çağrısı yok (CLAUDE.md, mimari kural 3).
 *
 * ## Neden artık yapılabiliyor
 *
 * `CLAUDE.md` bunu "Yapılmayacaklar" tablosuna koymuştu ve gerekçesi "Bedrock
 * komut grameri için makine okunur resmi kaynak yok" idi. Gerekçe yanlışmış:
 * `bedrock-samples` içinde `metadata/command_modules/mojang-commands.json`
 * var — 83 komut, 270 aşırı yükleme, 1149 parametre, 225 enum
 * (30-08-2026'da bulundu, `pipeline/src/commands.ts` çekiyor).
 *
 * ## Tasarım ilkesi: emin olmadığına hata deme
 *
 * 248 parametre tipinin 225'i enum tablosundan geliyor ve kesin doğrulanıyor.
 * Kalan 23 yapısal tipin bir kısmı henüz ayrıştırılmıyor; onlar **kabul
 * ediliyor**, uydurma hata üretilmiyor. Hangi tipin gerçekten kontrol edildiği
 * `CHECKED_TYPES` ile açıkça yazılı ve testte ölçülüyor.
 *
 * Yanlış pozitif burada en pahalı hata: çalışan bir komuta "bozuk" demek,
 * bozuk bir komutu kaçırmaktan kötü. Kullanıcı ilkine güvenini kaybeder.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { blockStates, normalizeId, resolveVersion } from "@codecraft/knowledge";

export type CommandParam = {
  name: string;
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
  commands: Record<string, CommandDef>;
  enums: Record<string, string[]>;
};

export type CommandErrorKind =
  /** `/` ile başlamıyor, boş, ya da komut adı okunamadı. */
  | "syntax"
  /** Böyle bir komut yok. */
  | "unknown-command"
  /** Hiçbir aşırı yükleme argümanlara uymadı. */
  | "arity"
  /** Argüman değeri tipine uymadı. */
  | "argument";

export type CommandError = {
  kind: CommandErrorKind;
  message: string;
  /** Kaçıncı argüman (0 = komut adı). Bilinmiyorsa null. */
  index: number | null;
};

export type CommandResult = {
  ok: boolean;
  /** Çözümlenen komut adı (alias çözülmüş hâli). Bulunamadıysa null. */
  command: string | null;
  /** Komut hile gerektiriyor mu. Kullanıcıya not olarak gösterilir. */
  requiresCheats: boolean;
  errors: CommandError[];
  /**
   * Komutun kabul ettiği kullanım biçimleri. Yalnızca hiçbiri uymadığında
   * dolar.
   *
   * Var olma sebebi ölçüm: `effect` gibi çok aşırı yüklemeli komutlarda
   * "en yakın aday" seçimi beraberliğe düşüyor ve tek bir hata mesajı
   * yanıltıcı olabiliyor (yanlış efekt adı, `Mode` hatası gibi görünüyordu).
   * Bütün biçimleri göstermek o belirsizliği gizlemek yerine açıyor.
   */
  usage: string[];
};

/** "give <player: SELECTION> <itemName: ITEM> [amount: INT]" */
const usageOf = (command: CommandDef): string[] =>
  command.overloads.map(
    (overload) =>
      `${command.name} ` +
      overload.params
        .map((p) => (p.optional ? `[${p.name}: ${p.type}]` : `<${p.name}: ${p.type}>`))
        .join(" "),
  );

// --------------------------------------------------------------------------
// İndeks yükleme
// --------------------------------------------------------------------------

const indexes = new Map<string, CommandIndex>();

export async function loadCommandIndex(version?: string): Promise<CommandIndex> {
  const { dir, index, version: resolved } = await resolveVersion(version);
  const cached = indexes.get(resolved);
  if (cached !== undefined) return cached;

  // Dosya adı sabit; index.json'daki kayıt onu geçersiz kılabilir ama zorunlu
  // değil. Böylece `pipeline:commands` tek başına koştuğunda da doğrulama
  // çalışıyor — index.json'ı yalnızca orkestratör yazıyor.
  const file = index.sources.commands?.file ?? "commands.json";

  let text: string;
  try {
    text = await readFile(join(dir, file), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error(
      `data/${resolved}/${file} yok — komut doğrulaması için ` +
        "`npm run pipeline:commands` koşulmalı",
    );
  }

  const loaded = JSON.parse(text) as CommandIndex;
  if (Object.keys(loaded.commands).length === 0) {
    throw new Error(`data/${resolved}/${file} boş — pipeline yarım kalmış`);
  }
  indexes.set(resolved, loaded);
  return loaded;
}

// --------------------------------------------------------------------------
// Sözcükleme
// --------------------------------------------------------------------------

/**
 * Komut satırını argümanlara böler.
 *
 * Boşlukla bölmek yetmiyor: seçiciler (`@e[type=zombie,r=5]`), JSON gövdeleri
 * (`{"rawtext":[...]}`), blok durumları (`["facing"="north"]`) ve tırnaklı
 * metinler kendi içinde boşluk taşıyor. Parantez/köşeli/süslü dengesi
 * sayılarak bölünüyor.
 *
 * Tırnak içindeki parantezler sayılmıyor — aksi hâlde `"a]b"` dengeyi bozardı.
 */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of line) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (quote !== null) {
      current += char;
      if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "[" || char === "{" || char === "(") depth += 1;
    else if (char === "]" || char === "}" || char === ")") depth = Math.max(0, depth - 1);

    if (/\s/.test(char) && depth === 0) {
      if (current !== "") tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current !== "") tokens.push(current);
  return tokens;
}

// --------------------------------------------------------------------------
// Yapısal tip denetleyicileri
// --------------------------------------------------------------------------

const INT_RE = /^[+-]?\d+$/;
/** Mutlak, göreli (~) veya yerel (^) tek koordinat bileşeni. */
const COORD_RE = /^[~^][+-]?(?:\d+\.?\d*|\.\d+)?$|^[+-]?(?:\d+\.?\d*|\.\d+)$/;
/** `1..5`, `..5`, `3..`, `4` */
const RANGE_RE = /^(?:\d+\.\.\d*|\.\.\d+|[+-]?\d+)$/;

/**
 * Eklenti kimliği biçimi: `codecraft:ruby_ore`. Başka hiçbir şey.
 *
 * Dar tutulması şart. Önceki hâli "iki nokta içeriyorsa kabul et" idi ve
 * `["uydurma_durum":1]` de iki nokta içerdiği için enum sanılıyordu.
 */
const CUSTOM_IDENTIFIER_RE = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;
/**
 * Geçerli hedef seçici harfleri — **oyundan ölçüldü**, elle yazılmadı.
 *
 * Mojang'ın makine okunur komut tanımında bu liste yok. Uydurmak yerine
 * `npm run ws:probe` ile oyuna soruldu (30-08-2026, Bedrock 1.26.x):
 * altısı `statusCode 0` ile kabul edildi, `@z` `@x` `@q` ise
 * `Syntax error: Unexpected "@z"` ile reddedildi.
 *
 * Ölçüm yordamı `docs/WEBSOCKET.md` ve `docs/COMMANDS.md` içinde; yeni bir
 * sürümde harf eklenirse aynı probe tekrar koşulup burası güncellenir.
 */
export const SELECTOR_LETTERS = ["s", "p", "a", "e", "r", "n"] as const;

/**
 * Gerçekten denetlenen yapısal tipler.
 *
 * Listede olmayan bir yapısal tip **kabul edilir**. Bu, kapsamın nerede
 * bittiğini gizlemek yerine görünür kılıyor: test bu listeyi ölçüyor ve
 * genişledikçe kayıt altına giriyor.
 */
export const CHECKED_TYPES = new Set([
  "INT",
  "WILDCARDINT",
  "POSITION",
  "POSITION_FLOAT",
  "FULLINTEGERRANGE",
  "SELECTION",
  "WILDCARDSELECTION",
  "OPERATOR",
  "COMPAREOPERATOR",
  "postfix_t",
  "postfix_s",
  "postfix_d",
  "postfix_l",
  "BLOCK_STATE_ARRAY",
]);

const OPERATORS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "<", ">", "><"]);
const COMPARE = new Set(["<", "<=", "=", ">=", ">"]);

/** Değer bu yapısal tipe uyuyor mu. Tip denetlenmiyorsa null döner. */
function checkStructural(type: string, value: string): string | null | undefined {
  switch (type) {
    case "INT":
      return INT_RE.test(value) ? null : "tam sayı bekleniyor";
    case "WILDCARDINT":
      return value === "*" || INT_RE.test(value) ? null : 'tam sayı ya da "*" bekleniyor';
    case "POSITION":
    case "POSITION_FLOAT":
      return COORD_RE.test(value)
        ? null
        : "koordinat bekleniyor (12, ~, ~-3, ^5 gibi)";
    case "FULLINTEGERRANGE":
      return RANGE_RE.test(value) ? null : "sayı ya da aralık bekleniyor (3, 1..5, ..5)";
    case "SELECTION":
    case "WILDCARDSELECTION":
      return checkSelector(value);
    case "OPERATOR":
      return OPERATORS.has(value) ? null : `işleç bekleniyor (${[...OPERATORS].join(" ")})`;
    case "COMPAREOPERATOR":
      return COMPARE.has(value) ? null : `karşılaştırma işleci bekleniyor (${[...COMPARE].join(" ")})`;
    case "postfix_t":
    case "postfix_s":
    case "postfix_d":
    case "postfix_l": {
      const suffix = type.slice("postfix_".length);
      return new RegExp(`^\\d+(?:\\.\\d+)?${suffix}$`).test(value)
        ? null
        : `sayı ve "${suffix}" eki bekleniyor (20${suffix} gibi)`;
    }
    default:
      // Henüz ayrıştırılmayan tip: kabul et, uydurma hata üretme.
      return undefined;
  }
}

/**
 * Hedef seçici: `@s`, `@e[type=zombie,r=5]`, ya da düz bir oyuncu adı.
 *
 * Köşeli parantez içindeki filtrelerin ANAHTARLARI doğrulanmıyor — Mojang
 * tanımı onları listelemiyor ve elle liste yazmak tam olarak bu projenin
 * kaçındığı şey. Yalnızca yapı denetleniyor: `@` ile başlıyorsa geçerli bir
 * seçici harfi olmalı ve köşeli parantez dengeli kapanmalı.
 */
function checkSelector(value: string): string | null {
  if (!value.startsWith("@")) {
    // Oyuncu adı ya da hedef adı. Boş olmadığı sürece kabul.
    return value.length > 0 ? null : "hedef bekleniyor";
  }

  const bracket = value.indexOf("[");
  const head = bracket === -1 ? value : value.slice(0, bracket);
  const letter = head.slice(1);
  if (!(SELECTOR_LETTERS as readonly string[]).includes(letter)) {
    return (
      `geçersiz seçici "${head}" — kabul edilenler: ` +
      SELECTOR_LETTERS.map((l) => `@${l}`).join(", ")
    );
  }
  if (bracket === -1) return null;

  if (!value.endsWith("]")) return "seçici filtresi ']' ile kapanmalı";
  return null;
}

// --------------------------------------------------------------------------
// Blok durumları
// --------------------------------------------------------------------------

/** Virgülle böler ama tırnak içindekileri saymaz. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const char of text) {
    if (quote !== null) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "") parts.push(current);
  return parts;
}

const unquote = (value: string): string =>
  value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.at(-1) === value[0]
    ? value.slice(1, -1)
    : value;

export type BlockStatePair = { key: string; value: string };

/** Biçim tanınmadığında sebebini söyleyen sonuç. */
export type BlockStateParse =
  | { ok: true; pairs: BlockStatePair[] }
  | { ok: false; reason: string };

/**
 * `["facing_direction":3,"open_bit":true]` → çiftler.
 *
 * **Ayraç iki nokta, eşittir değil.** Bu oyundan ölçüldü (30-08-2026,
 * `npm run ws:probe`) ve doğrulayıcının ilk hâlini çürüttü:
 *
 *   ["facing_direction":0]   ayrıştı
 *   ["facing_direction"=0]   Syntax error: Unexpected "="
 *   ["facing_direction"]     Syntax error: Unexpected "]"   (değer zorunlu)
 *   [facing_direction:0]     ad tırnaksız kabul edilmiyor
 *   []                       ayrıştı
 *
 * Önce `=` bekleniyordu; o hâl her iki yönde de yanlıştı — oyunun reddettiği
 * biçimi geçiriyor, kabul ettiğini reddediyordu.
 */
export function parseBlockStates(text: string): BlockStateParse {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return { ok: false, reason: 'blok durumu ["ad":değer] biçiminde olmalı' };
  }

  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") return { ok: true, pairs: [] };

  const pairs: BlockStatePair[] = [];
  for (const raw of splitTop(inner)) {
    const part = raw.trim();

    // Ad tırnak içinde ve KENDİSİ iki nokta içerebiliyor
    // ("minecraft:cardinal_direction"), o yüzden ayraç kapanış tırnağından
    // sonra aranıyor — baştan aramak adı ikiye bölerdi.
    if (!part.startsWith('"')) {
      return { ok: false, reason: `durum adı tırnak içinde olmalı: ${part}` };
    }
    const closing = part.indexOf('"', 1);
    if (closing === -1) {
      return { ok: false, reason: `durum adının tırnağı kapanmamış: ${part}` };
    }

    const rest = part.slice(closing + 1).trim();
    if (!rest.startsWith(":")) {
      return {
        ok: false,
        reason: rest.startsWith("=")
          ? 'ayraç iki nokta olmalı, eşittir değil: ["ad":değer]'
          : 'her durum bir değer almalı: ["ad":değer]',
      };
    }

    pairs.push({
      key: part.slice(1, closing),
      value: unquote(rest.slice(1).trim()),
    });
  }
  return { ok: true, pairs };
}

/**
 * Blok durumlarını `data/<sürüm>/blocks.json` indeksine karşı doğrular.
 *
 * Bu boşluk `docs/COMMANDS.md` içinde "kapatılabilir" diye kayıtlıydı: veri
 * zaten elimizdeydi, her bloğun durum adları ve alabildiği değerlerle birlikte.
 *
 * Blok bilinmiyorsa (özel namespace, ya da indekste yok) **sessizce geçilir** —
 * kimlik kontrolü zaten ayrı bir eksende bunu yakalıyor ve burada ikinci kez
 * hata üretmek kullanıcıya aynı sorunu iki kez gösterirdi.
 */
async function checkBlockStates(
  raw: string,
  blockId: string | null,
  version: string | undefined,
): Promise<string | null> {
  // Eski veri değeri biçimi — OYUNDA ÖLÇÜLDÜ (30-08-2026, ws:probe):
  //
  //   fill ~ ~ ~ ~ ~ ~ minecraft:air 0 replace       → ayrıştı
  //   fill ~ ~ ~ ~ ~ ~ minecraft:air BOGUS replace   → sözdizimi hatası
  //
  // Mojang'ın yayımladığı tanımda bu biçim yok (hiçbir aşırı yüklemede blok
  // adından sonra INT parametresi geçmiyor) ama gerçek ayrıştırıcı geriye
  // dönük uyumluluk için kabul ediyor. Doğrulayıcı önce reddediyordu; bu bir
  // yanlış pozitifti ve ölçüm onu çürüttü.
  if (INT_RE.test(raw.trim())) return null;

  const parsed = parseBlockStates(raw);
  if (!parsed.ok) return parsed.reason;
  const pairs = parsed.pairs;
  if (pairs.length === 0 || blockId === null) return null;

  const states = await blockStates(normalizeId(blockId), version);
  // Blok indekste yok: kimlik kontrolünün işi, burada tekrar edilmiyor.
  if (states === null) return null;

  for (const { key, value } of pairs) {
    const property = states[key];
    if (property === undefined) {
      const known = Object.keys(states);
      return known.length === 0
        ? `"${blockId}" bloğunun hiç durumu yok, "${key}" verilemez`
        : `"${key}" ${blockId} bloğunun durumu değil. Durumları: ${known.join(", ")}`;
    }

    const allowed = property.values.map((v) => String(v));
    if (!allowed.includes(value)) {
      return `"${key}" için "${value}" geçerli değil. Kabul edilenler: ${allowed.join(", ")}`;
    }
  }

  return null;
}

// --------------------------------------------------------------------------
// Aşırı yükleme eşleştirme
// --------------------------------------------------------------------------

/**
 * Bir parametrenin kaç argüman tükettiği.
 *
 * Ölçülerek bulundu, varsayılmadı: `fill from:POSITION to:POSITION ...` altı
 * sayı alıyor, yani POSITION üç token. `say message:MESSAGE_ROOT` satırın
 * kalanını alıyor. Bunu bilmeden eşleştirmek her çok argümanlı komuta
 * "fazladan argüman" dedirtiyordu.
 */
const WIDTHS: Record<string, number> = {
  POSITION: 3,
  POSITION_FLOAT: 3,
};

/** Satırın kalanını tüketen tipler. */
const REST_TYPES = new Set(["MESSAGE_ROOT", "RAWTEXT"]);

type Attempt = {
  /** Kaç argüman sorunsuz tüketildi. En iyi adayı seçmek için. */
  consumed: number;
  errors: CommandError[];
};

/**
 * Enum eşleşmesi, namespace'e toleranslı.
 *
 * Enum değerleri namespace'siz tutuluyor (`speed`), oysa oyunda
 * `minecraft:speed` de geçerli — ikisi de kabul edilir. Ters yön kabul
 * edilmiyor: enum'da `minecraft:` önekli bir değer varsa aynen aranır.
 */
function matchesEnum(values: readonly string[], value: string): boolean {
  if (values.includes(value)) return true;

  if (value.startsWith("minecraft:")) {
    return values.includes(value.slice("minecraft:".length));
  }

  // Başka bir namespace: eklenti kimliği. Komut grameri bunu bilemez — paketin
  // kendi bloğu, item'ı ya da entity'si olabilir ve oyunda geçerlidir. Kabul
  // ediliyor; var olup olmadığı checkCommandIdentities'in ayrı ekseni.
  //
  // Ölçülerek eklendi: `/setblock ~ ~ ~ codecraft:ruby_ore` reddediliyordu,
  // yani kullanıcının kendi bloğu "geçersiz" görünüyordu.
  //
  // Kalıp DAR olmalı. İlk hâli "iki nokta içeriyorsa kabul et" diyordu ve
  // `["uydurma_durum":1]` de iki nokta içerdiği için enum sanılıp yanlış aşırı
  // yüklemeye uyuyordu — blok durumu denetimi böylece hiç koşmuyordu. Testler
  // yakaladı.
  return CUSTOM_IDENTIFIER_RE.test(value);
}

/** Tek bir aşırı yüklemeyi dener. */
async function tryOverload(
  overload: CommandOverload,
  args: readonly string[],
  index: CommandIndex,
  version: string | undefined,
): Promise<Attempt> {
  const errors: CommandError[] = [];
  let cursor = 0;
  // Blok durumları hangi bloğa ait olduğunu bilmeden doğrulanamıyor; aynı
  // aşırı yüklemede kendinden önce gelen BLOCK parametresi o bloğu veriyor.
  let lastBlock: string | null = null;

  for (const param of overload.params) {
    if (cursor >= args.length) {
      if (param.optional) continue;
      errors.push({
        kind: "arity",
        message: `eksik argüman: ${param.name} (${param.type})`,
        index: cursor + 1,
      });
      return { consumed: cursor, errors };
    }

    const rest = REST_TYPES.has(param.type);
    const width = rest ? args.length - cursor : (WIDTHS[param.type] ?? 1);
    const slice = args.slice(cursor, cursor + width);

    if (slice.length < width) {
      errors.push({
        kind: "arity",
        message: `${param.name} için ${width} değer bekleniyor, ${slice.length} verildi`,
        index: cursor + 1,
      });
      return { consumed: cursor, errors };
    }

    if (param.type === "BLOCK_STATE_ARRAY") {
      const problem = await checkBlockStates(slice[0] as string, lastBlock, version);
      if (problem !== null) {
        errors.push({ kind: "argument", message: `${param.name}: ${problem}`, index: cursor + 1 });
        return { consumed: cursor, errors };
      }
      cursor += width;
      continue;
    }

    const values = index.enums[param.type.toLowerCase()];
    // BOŞ ENUM "hiçbir değer geçerli değil" DEĞİL, "serbest metin" demek.
    //
    // Ölçüldü (01-09-2026, Aşama M5 senaryo 3): 225 enum'un DÖRDÜ kaynak
    // veride tamamen boş — tagvalues, scoreboardobjectives, gametestname,
    // gametesttag. Bunlar oyunun ÇALIŞMA ANINDA dünyadan doldurduğu listeler
    // (dünyadaki etiketler, tanımlı skorbord hedefleri). Mojang'ın metadata'sı
    // onları boş yayınlıyor çünkü değerleri dünyaya bağlı, şemaya değil.
    //
    // Boşu "geçerli değer yok" diye okumak dört komutu birden yanlış
    // reddediyordu — /tag, /scoreboard, /execute (objective), /gametest:
    //
    //   /scoreboard objectives add kills dummy   ok=false  (doğru komut)
    //   /tag @s add kutucu                       ok=false  (doğru komut)
    //
    // Üstelik hata mesajı da bozuktu: "Kabul edilenler:" sonrası boş liste.
    // Yanlış pozitif, CodeCraft'ın önlemek için var olduğu hatanın ters yönden
    // aynısı. Gerçek bir oturumda bulundu — docs/mcp-kullanim.md, senaryo 3.
    if (values !== undefined && values.length > 0) {
      const value = slice[0] as string;
      if (matchesEnum(values, value)) {
        if (param.type === "BLOCK") lastBlock = value;
        cursor += width;
        continue;
      }
      const shown = values.slice(0, 8).join(", ");
      errors.push({
        kind: "argument",
        message:
          `"${value}" ${param.name} için geçerli değil. Kabul edilenler: ${shown}` +
          (values.length > 8 ? ` … (+${values.length - 8})` : ""),
        index: cursor + 1,
      });
      return { consumed: cursor, errors };
    }

    let failed = false;
    for (const [offset, value] of slice.entries()) {
      const problem = checkStructural(param.type, value);
      // undefined: tip henüz denetlenmiyor. null: geçti.
      if (problem === undefined || problem === null) continue;
      errors.push({
        kind: "argument",
        message: `${param.name}: ${problem}`,
        index: cursor + offset + 1,
      });
      failed = true;
      break;
    }
    if (failed) return { consumed: cursor, errors };

    cursor += width;
  }

  if (cursor < args.length) {
    errors.push({
      kind: "arity",
      message: `fazladan argüman: "${args.slice(cursor).join(" ")}"`,
      index: cursor + 1,
    });
  }

  return { consumed: cursor, errors };
}

export type CommandOptions = {
  /** data/ içindeki sürüm. Verilmezse en yenisi. */
  version?: string;
};

/**
 * Tek bir komut satırını doğrular.
 *
 * Aşırı yüklemelerin herhangi biri uyuyorsa komut geçerlidir. Hiçbiri
 * uymuyorsa **en çok argüman tüketen** aşırı yüklemenin hataları raporlanır —
 * kullanıcıya en yakın olan yorum o.
 */
export async function validateCommand(
  line: string,
  options: CommandOptions = {},
): Promise<CommandResult> {
  const index = await loadCommandIndex(options.version);
  const trimmed = line.trim();

  if (trimmed === "") {
    return {
      ok: false,
      command: null,
      requiresCheats: false,
      errors: [{ kind: "syntax", message: "komut boş", index: null }],
      usage: [],
    };
  }

  const body = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const tokens = tokenize(body);
  const name = tokens[0];
  if (name === undefined) {
    return {
      ok: false,
      command: null,
      requiresCheats: false,
      errors: [{ kind: "syntax", message: "komut adı okunamadı", index: null }],
      usage: [],
    };
  }

  const lower = name.toLowerCase();
  const definition =
    index.commands[lower] ??
    Object.values(index.commands).find((command) => command.aliases.includes(lower));

  if (definition === undefined) {
    return {
      ok: false,
      command: null,
      requiresCheats: false,
      errors: [
        {
          kind: "unknown-command",
          message: `"${name}" diye bir komut yok`,
          index: 0,
        },
      ],
      usage: [],
    };
  }

  const args = tokens.slice(1);
  const attempts: Attempt[] = [];
  for (const overload of definition.overloads) {
    attempts.push(await tryOverload(overload, args, index, options.version));
  }
  const matched = attempts.find((attempt) => attempt.errors.length === 0);

  if (matched !== undefined || definition.overloads.length === 0) {
    return {
      ok: true,
      command: definition.name,
      requiresCheats: definition.requiresCheats,
      errors: [],
      usage: [],
    };
  }

  // En çok argüman tüketen aday, kullanıcının kastettiğine en yakın olan.
  // Beraberlikte "yanlış değer" hatası "eksik argüman" hatasına yeğleniyor:
  // ilki neyin yanlış olduğunu söyler, ikincisi yalnızca eksiği.
  const rank = (attempt: Attempt): number =>
    attempt.consumed * 2 + (attempt.errors[0]?.kind === "argument" ? 1 : 0);
  const best = attempts.reduce((a, b) => (rank(b) > rank(a) ? b : a));

  return {
    ok: false,
    command: definition.name,
    requiresCheats: definition.requiresCheats,
    errors: best.errors,
    usage: usageOf(definition),
  };
}
