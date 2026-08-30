/**
 * Script doğrulama: @minecraft/* tip tanımlarına karşı tsc sarmalayıcısı.
 * Saf fonksiyon, model çağrısı yok (CLAUDE.md, mimari kural 3).
 *
 * Neden JS API değil de ikili çalıştırılıyor: kurulu typescript@7 Go portu ve
 * JS yüzeyi yalnızca "typescript/unstable/*" altında — adı gereği kararlı değil.
 * bin/tsc kararlı ve belgeli.
 *
 * Modül sürümleri koda gömülmez, data/<sürüm>/index.json'dan okunur (CLAUDE.md).
 * @minecraft/common atlanamaz: server ve server-ui doğrudan ondan import ediyor,
 * olmadan tsc "Cannot find module" verir ve hiçbir kod doğrulanamaz
 * (docs/SOURCES.md).
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { resolveVersion } from "@codecraft/knowledge";

/** Kararlı modül sürümü mü, beta mı. index.json ikisini de kaydediyor. */
export type ScriptChannel = "stable" | "beta";

export type ScriptOptions = {
  version?: string;
  /** Varsayılan "stable". Beta yoksa kararlıya düşer. */
  channel?: ScriptChannel;
};

export type ScriptDiagnostic = {
  line: number;
  column: number;
  /** TypeScript hata kodu: "TS2551" */
  code: string;
  message: string;
};

export type ScriptResult = {
  ok: boolean;
  version: string;
  /** Hangi modül sürümlerine karşı derlendi. */
  modules: Record<string, string>;
  errors: ScriptDiagnostic[];
};

/**
 * Giriş dosyası `.js` — çünkü doğrulanan şey JavaScript.
 *
 * Bedrock davranış paketleri düz `.js` çalıştırıyor ve üretilen çıktı da öyle.
 * Kodu `.ts` olarak denetlemek, TypeScript'in yazım kurallarını Bedrock
 * kuralıymış gibi dayatıyordu:
 *
 *   const blocksToBreak = [];      // .ts'te never[], .js'te any[]
 *   blocksToBreak.push(location);  // .ts'te TS2345, oyunda sorunsuz
 *
 * İkisi de gerçek model çıktısında ölçüldü (30-08-2026 kapı koşuları) ve
 * ikisi de oyunda çalışan kodu düşürüyordu. `checkJs` ile TypeScript aynı tip
 * tanımlarını kullanır ama çıkarımı JavaScript'e göre yapar.
 */
const ENTRY = "main.js";

/**
 * Bedrock script çalışma zamanı console veriyor ama hiçbir .d.ts onu
 * tanımlamıyor. Kanıt Mojang'ın kendi paketinde: @minecraft/server 2.9.0
 * içindeki JSDoc örnekleri console.warn (satır 5612) ve console.error
 * (satır 24819) kullanıyor.
 *
 * Tanımsız bırakmak geçerli script'leri yanlışlıkla reddederdi. "lib": ["DOM"]
 * eklemek ise fetch, document, window gibi Bedrock'ta olmayan her şeyi kabul
 * ederdi — yani uydurulmuş API'yi geçirirdi, ki bu aracın var olma sebebi tam
 * olarak onu engellemek. Bu yüzden sadece kanıtı olan üç metot tanımlanıyor.
 *
 * Ayrı bir .d.ts dosyasında duruyor, kullanıcının kodunun başına eklenmiyor:
 * giriş dosyası artık .js ve `declare` orada sözdizimi hatası (TS8009). Ayrı
 * dosya olmasının ikinci faydası, satır numaralarının kaymaması — eskiden
 * kaydırma elle geri alınıyordu.
 */
const GLOBALS = "codecraft-globals.d.ts";

const GLOBALS_SOURCE = `declare const console: {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
`;

/** main.js(12,5): error TS2339: mesaj */
const DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

const require_ = createRequire(import.meta.url);

/** typescript paketinin bin/tsc dosyası. Kök node_modules'tan çözülür. */
function tscBin(): string {
  return join(dirname(require_.resolve("typescript/package.json")), "bin", "tsc");
}

/**
 * Modül adı -> index.d.ts mutlak yolu.
 * Beta istenip o modülün betası yoksa kararlıya düşer; ikisi de yoksa durulur.
 */
async function resolveModules(
  options: ScriptOptions,
): Promise<{ version: string; paths: Record<string, string>; modules: Record<string, string> }> {
  const { dir, index, version } = await resolveVersion(options.version);
  const channel = options.channel ?? "stable";
  const { path, modules } = index.sources.scriptTypes;

  const paths: Record<string, string> = {};
  const chosen: Record<string, string> = {};
  for (const [name, available] of Object.entries(modules)) {
    const release = (channel === "beta" ? available.beta : null) ?? available.stable;
    if (release === null) {
      throw new Error(`${name}: data/${version} içinde kullanılabilir sürüm yok`);
    }
    chosen[name] = release;
    paths[name] = join(dir, path, name, release, "index.d.ts");
  }

  if (Object.keys(paths).length === 0) {
    throw new Error(`data/${version}/index.json içinde script modülü kaydı yok`);
  }
  return { version, paths, modules: chosen };
}

function buildTsconfig(paths: Record<string, string>): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023"],
        module: "esnext",
        // Üretilen script'ler paketleyiciden geçiyor ve import'larda uzantı
        // kullanmıyor; "bundler" en az yanlış pozitif üreten çözümleme.
        moduleResolution: "bundler",
        types: [],
        strict: true,
        // JavaScript'i JavaScript olarak denetle. Aynı @minecraft/* tip
        // tanımları kullanılır, ama çıkarım TypeScript yazım kurallarına değil
        // JS'e göre yapılır.
        //
        // Gerekçe ölçümle geldi: iki ayrı kapı koşusunda model, oyunda
        // çalışacak kod üretti ve doğrulama onu TypeScript'e özgü iki kuralla
        // düşürdü — tipsiz parametre (TS7006) ve boş dizinin `never[]`
        // çıkarımı (TS2345/TS2339). Hiçbiri Bedrock API'sinin yanlış
        // kullanıldığını göstermiyordu.
        //
        // strict AÇIK kalıyor: strictNullChecks, tip uyuşmazlığı, olmayan
        // modül ve 2.x'te kaldırılmış çağrılar hâlâ yakalanıyor — gerçek API
        // hatalarını gösteren şeyler onlar. Testte negatif kontrolü var.
        allowJs: true,
        checkJs: true,
        // checkJs tek başına yetmiyor: strict altında noImplicitAny .js
        // dosyalarında da uygulanıyor ve tipsiz parametreyi (TS7006)
        // reddediyor. İkisi ayrı kurallar, ikisi de gevşetilmeli — testte
        // ikisinin de örneği var.
        noImplicitAny: false,
        noEmit: true,
        skipLibCheck: true,
        // paths mutlak yol veriyor: symlink kurmuyoruz, Windows'ta yönetici
        // yetkisi ister ve geliştirme ortamı Windows.
        paths: Object.fromEntries(Object.entries(paths).map(([name, file]) => [name, [file]])),
      },
      files: [GLOBALS, ENTRY],
    },
    null,
    2,
  );
}

function runTsc(cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tscBin(), "-p", "tsconfig.json", "--pretty", "false"], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, output }));
  });
}

/**
 * Kodu @minecraft/* tiplerine karşı derler.
 *
 * Sadece giriş dosyasından gelen tanılar kullanıcı hatası sayılır. Başka bir dosyadan
 * veya dosyasız gelen bir tanı bizim tsconfig'imizin bozuk olduğu anlamına
 * gelir; sessizce kullanıcıya yazılmaz, istisna fırlatılır.
 */
export async function validateScript(
  code: string,
  options: ScriptOptions = {},
): Promise<ScriptResult> {
  const { version, paths, modules } = await resolveModules(options);
  const dir = await mkdtemp(join(tmpdir(), "codecraft-tsc-"));

  try {
    await writeFile(join(dir, ENTRY), code, "utf8");
    await writeFile(join(dir, GLOBALS), GLOBALS_SOURCE, "utf8");
    await writeFile(join(dir, "tsconfig.json"), buildTsconfig(paths), "utf8");

    const { code: exit, output } = await runTsc(dir);
    const errors: ScriptDiagnostic[] = [];

    for (const line of output.split(/\r?\n/)) {
      if (line.trim() === "") continue;
      const match = DIAGNOSTIC_RE.exec(line);
      if (match === null) {
        throw new Error(`tsc çıktısı çözümlenemedi: ${line}`);
      }
      const [, file, row, column, errorCode, message] = match as unknown as string[];
      if (file !== ENTRY) {
        throw new Error(`tsc ${file} dosyasından hata verdi — doğrulama ortamı bozuk: ${message}`);
      }
      errors.push({
        // Kullanıcının kodu dosyaya olduğu gibi yazılıyor: satır numaraları
        // doğrudan eşleşiyor, kaydırma düzeltmesi gerekmiyor.
        line: Number(row),
        column: Number(column),
        code: errorCode as string,
        message: message as string,
      });
    }

    if (exit !== 0 && errors.length === 0) {
      throw new Error(`tsc ${exit} koduyla çıktı ama tanı üretmedi:\n${output}`);
    }

    return { ok: errors.length === 0, version, modules, errors };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
