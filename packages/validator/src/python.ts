/**
 * Üretilen Python otomasyon script'lerinin doğrulanması.
 *
 * NEDEN VAR. Python, behavior pack'in içinde çalışan bir dil değil — paketin
 * içinde JS/TS ve `@minecraft/server` var. Python **dışarıdan** çalışan
 * otomasyon kanalı ve oyunla `/connect` WebSocket köprüsü üzerinden konuşuyor
 * (`docs/WEBSOCKET.md`). `CLAUDE.md` v1 kapsamında açıkça sayıyor.
 *
 * Bugüne kadar bu çıktı hiç doğrulanmıyordu: `packages/core/src/output.ts`
 * "script ve json ölçülebiliyor, command ve python ölçülemiyor" diyordu.
 *
 * ÜÇ EKSEN, üçü de ayrı ayrı raporlanıyor:
 *
 *   1. Sözdizimi   — gerçek Python yorumlayıcısı `compile()` ile
 *   2. Komut       — script'e gömülü Minecraft komutları validateCommand ile
 *   3. Protokol    — /connect mesaj zarfının ölçülmüş biçimi
 *
 * İkincisi en değerlisi: `docs/COMMANDS.md`'deki 4 numaralı boşluk tam olarak
 * kullanıcıya oyunda çalışmayan bir komut gitmesiydi ve onu hiçbir test değil,
 * oyunda denemek yakaladı. Python script'inin gövdesindeki komut bugüne kadar
 * hiçbir doğrulayıcıdan geçmiyordu.
 *
 * KURAL ESNETİLDİ, sessizce değil. `CLAUDE.md` "Stack" bölümü "Altyapıda
 * Python çalıştırılmıyor" diyordu; sözdizimi ayağı bir alt süreç açıyor ve o
 * satırı esnetiyor. Kullanıcıya soruldu ve onaylandı (02-09-2026). "Stack"
 * bölümü `CLAUDE.md`'nin kendi tanımına göre değiştirilebilir — değiştirilemez
 * olanlar yalnızca "Mimari kurallar" ve "Yapılmayacaklar".
 *
 * Python yoksa sözdizimi ayağı ATLANIR ve bunu çıktısında SÖYLER. Sessizce
 * atlayıp "ok" dönmek, doğrulanmamış bir çıktıyı doğrulanmış göstermek olurdu.
 */
import { spawn } from "node:child_process";

import { validateCommand } from "./command.ts";

export type PythonOptions = {
  /** data/ içindeki sürüm. Komut doğrulamasına geçiliyor. */
  version?: string;
};

export type PythonFinding = {
  kind: "syntax" | "command" | "protocol";
  /** 1'den başlayan satır. Bilinmiyorsa null. */
  line: number | null;
  message: string;
  /** Bulguyu doğuran satırın kendisi. Kısaltılmış. */
  evidence: string | null;
};

export type PythonResult = {
  ok: boolean;
  /**
   * Sözdizimi gerçekten kontrol edildi mi.
   *
   * false ise `syntaxSkipped` sebebi taşıyor. `ok: true` + `syntaxChecked:
   * false` "sözdizimi doğru" DEMEZ, "bakılamadı" der.
   */
  syntaxChecked: boolean;
  syntaxSkipped: string | null;
  /** Kaç komut satırı doğrulandı. Sıfır, komut bulunmadığı anlamına gelir. */
  commandsChecked: number;
  findings: PythonFinding[];
};

/**
 * Denenecek yorumlayıcılar, sırayla.
 *
 * Windows'ta `python`, çoğu Linux dağıtımında `python3`. `py` Windows'un
 * launcher'ı ve ikisi de yoksa son şans.
 */
const PYTHON_CANDIDATES = ["python3", "python", "py"] as const;

/**
 * Sözdizimini ölçen program.
 *
 * `py_compile` yerine düz `compile()`: py_compile diske .pyc yazmaya çalışıyor
 * ve salt okunur bir ortamda o yüzden düşebilir — ölçtüğümüz şey sözdizimi,
 * yazma izni değil. Çıktı tek satır ve sekmeyle ayrılmış, ayrıştırması
 * belirsizliğe yer bırakmıyor.
 */
const SYNTAX_PROBE = [
  "import sys",
  "src = sys.stdin.read()",
  "try:",
  "    compile(src, '<script>', 'exec')",
  "except SyntaxError as e:",
  "    print('%d\\t%s' % (e.lineno or 0, (e.msg or 'sözdizimi hatası').replace('\\t', ' ')))",
  "    sys.exit(1)",
  "except ValueError as e:",
  "    print('0\\t%s' % str(e).replace('\\t', ' '))",
  "    sys.exit(1)",
].join("\n");

type Run = { code: number; stdout: string; stderr: string };

function run(command: string, args: readonly string[], input?: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    if (input !== undefined) child.stdin.end(input, "utf8");
    else child.stdin.end();
  });
}

/** Çalışan ilk yorumlayıcı, yoksa null. Süreç ömrü boyunca hatırlanır. */
let cachedPython: string | null | undefined;

async function findPython(): Promise<string | null> {
  if (cachedPython !== undefined) return cachedPython;
  for (const candidate of PYTHON_CANDIDATES) {
    try {
      const result = await run(candidate, ["--version"]);
      if (result.code === 0) {
        cachedPython = candidate;
        return candidate;
      }
    } catch {
      // Bulunamadı; sıradakine geç.
    }
  }
  cachedPython = null;
  return null;
}

/** Test ve ölçüm için: yorumlayıcı arayışını sıfırlar. */
export function resetPythonCache(): void {
  cachedPython = undefined;
}

/**
 * Komut satırı gibi görünen dize sabitleri.
 *
 * KAPSAM DAR VE BİLEREK DAR: yalnızca `/` ile BAŞLAYAN dizeler komut sayılıyor.
 * "İlk kelimesi komut adına benziyorsa komuttur" kuralı denendi ve reddedildi —
 * `"say"` ya da `"list"` gibi sıradan bir dize komut sanılıp arity hatası
 * üretirdi. Yanlış pozitif, bu projenin önlemek için var olduğu hatanın ters
 * yönden aynısı; kapsamı daraltmak yanlış alarm üretmekten iyi.
 *
 * Bunun bedeli: `sock.send(json.dumps({"commandLine": "say hi"}))` biçiminde
 * eğik çizgisiz yazılmış komutlar görülmüyor. Kapsam gizlenmiyor, burada
 * yazılı.
 */
const COMMAND_LITERAL = /(['"])(\/[^'"\n]{1,300}?)\1/g;

/** Ölçülmüş `messagePurpose` değerleri — docs/WEBSOCKET.md. */
const MESSAGE_PURPOSES = new Set(["subscribe", "unsubscribe", "commandRequest"]);

/** Gelen tarafta görülenler; script'in GÖNDERDİĞİ bir zarfta bulunmamalı. */
const INCOMING_PURPOSES = new Set(["event", "commandResponse", "error"]);

const PURPOSE_LITERAL = /["']messagePurpose["']\s*:\s*(['"])([^'"]*)\1/g;

/** Satır numarası: eşleşmenin kaynaktaki indeksine göre. */
const lineOf = (source: string, index: number): number =>
  source.slice(0, index).split("\n").length;

const evidenceOf = (source: string, line: number): string | null => {
  const text = source.split("\n")[line - 1];
  if (text === undefined) return null;
  const trimmed = text.trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
};

/**
 * Bir Python otomasyon script'ini doğrular.
 *
 * `ok` üç eksenin de temiz olması demek. Sözdizimi bakılamadıysa `ok` yine
 * true olabilir ama `syntaxChecked` false kalır — çağıran ikisine birden
 * bakmak zorunda.
 */
export async function validatePython(
  code: string,
  options: PythonOptions = {},
): Promise<PythonResult> {
  const findings: PythonFinding[] = [];

  // 1 — Sözdizimi.
  let syntaxChecked = false;
  let syntaxSkipped: string | null = null;
  const python = await findPython();
  if (python === null) {
    syntaxSkipped =
      "Python yorumlayıcısı bulunamadı (python3, python, py denendi). " +
      "Sözdizimi kontrol EDİLMEDİ; diğer eksenler koştu.";
  } else {
    try {
      const result = await run(python, ["-c", SYNTAX_PROBE], code);
      syntaxChecked = true;
      if (result.code !== 0) {
        const [rawLine, ...rest] = result.stdout.trim().split("\t");
        const line = Number(rawLine);
        const message = rest.join("\t") || result.stderr.trim() || "sözdizimi hatası";
        findings.push({
          kind: "syntax",
          line: Number.isFinite(line) && line > 0 ? line : null,
          message,
          evidence: Number.isFinite(line) && line > 0 ? evidenceOf(code, line) : null,
        });
      }
    } catch (error) {
      syntaxSkipped = `Python çalıştırılamadı: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2 — Gömülü komutlar.
  let commandsChecked = 0;
  for (const match of code.matchAll(COMMAND_LITERAL)) {
    const line = match[2] as string;
    const at = lineOf(code, match.index);
    commandsChecked += 1;
    const result = await validateCommand(line, { version: options.version });
    if (result.ok) continue;
    for (const error of result.errors) {
      findings.push({
        kind: "command",
        line: at,
        message: `${line} — ${error.message}`,
        evidence: evidenceOf(code, at),
      });
    }
  }

  // 3 — Protokol zarfı.
  for (const match of code.matchAll(PURPOSE_LITERAL)) {
    const purpose = match[2] as string;
    const at = lineOf(code, match.index);
    if (MESSAGE_PURPOSES.has(purpose)) continue;
    const known = INCOMING_PURPOSES.has(purpose);
    findings.push({
      kind: "protocol",
      line: at,
      message: known
        ? `messagePurpose "${purpose}" oyundan GELEN mesajlarda görülüyor, ` +
          `gönderilen bir zarfta değil. Gönderilecek olanlar: ${[...MESSAGE_PURPOSES].join(", ")}`
        : `messagePurpose "${purpose}" ölçülmüş değerlerden biri değil. ` +
          `Ölçülenler: ${[...MESSAGE_PURPOSES].join(", ")} (docs/WEBSOCKET.md)`,
      evidence: evidenceOf(code, at),
    });
  }

  return {
    ok: findings.length === 0,
    syntaxChecked,
    syntaxSkipped,
    commandsChecked,
    findings,
  };
}

export type PythonRuntimeCheck = { ok: boolean; detail: string; ms: number };

/**
 * Sözdizimi ayağının ön koşulu ölçülür.
 *
 * `scriptRuntimeReport`'un aynı gerekçesi: dağıtılmış bir ortamda Python'un
 * bulunup bulunmadığı ölçülene kadar BİLİNMİYOR. Vercel'in Node runtime'ında
 * olmayabilir ve o zaman araç sözdizimi ayağını atlar — ama bunu bilerek ve
 * söyleyerek yapar.
 */
export async function pythonRuntimeReport(): Promise<Record<string, PythonRuntimeCheck>> {
  const started = performance.now();
  resetPythonCache();
  const python = await findPython();
  const ms = Math.round(performance.now() - started);

  if (python === null) {
    return {
      python: {
        ok: false,
        detail: `bulunamadı — denenenler: ${PYTHON_CANDIDATES.join(", ")}`,
        ms,
      },
    };
  }

  const version = await run(python, ["--version"]);
  const probeStarted = performance.now();
  const probe = await run(python, ["-c", SYNTAX_PROBE], "x = 1\n");

  return {
    python: { ok: true, detail: `${python} — ${version.stdout.trim() || version.stderr.trim()}`, ms },
    compile: {
      ok: probe.code === 0,
      detail: probe.code === 0 ? "geçerli kaynak kabul edildi" : probe.stdout.trim() || probe.stderr.trim(),
      ms: Math.round(performance.now() - probeStarted),
    },
  };
}
