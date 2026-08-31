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
import { constants, existsSync } from "node:fs";
import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { MARKERS, ROOT, resolveVersion } from "@codecraft/knowledge";

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

/** Satir sonu, CRLF ve LF. */
const NEWLINE_RE = /\r?\n/;

/** main.js(12,5): error TS2339: mesaj */
const DIAGNOSTIC_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

const require_ = createRequire(import.meta.url);

/**
 * typescript paketinin bin/tsc dosyası.
 *
 * ÖNCE repo kökündeki node_modules'a bakılıyor, SONRA `require.resolve`'a.
 * Sıra bu şekilde çünkü ikincisi paketleyicide kırılıyor: Aşama 4'te ölçüldü,
 * Turbopack `require.resolve`'u kendi çalışma zamanına çeviriyor ve dosya yolu
 * yerine sayısal bir modül kimliği döndürüyor. Belirtisi şuydu:
 *
 *   TypeError: The "path" argument must be of type string. Received type number
 *
 * npm workspaces typescript'i zaten köke kaldırıyor, yani ilk yol normal
 * kurulumda hep tutuyor. `require.resolve` kaldırılmadı: farklı bir paket
 * yöneticisinde (kaldırma yapmayan) tek çalışan yol o.
 */
function tscBin(): string {
  const hoisted = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  if (existsSync(hoisted)) return hoisted;

  const resolved = require_.resolve("typescript/package.json");
  if (typeof resolved !== "string") {
    throw new Error(
      "typescript paketi bulunamadı: require.resolve dosya yolu yerine " +
        `${typeof resolved} döndürdü. Paketleyici araya girmiş olabilir; ` +
        `beklenen yol ${hoisted}`,
    );
  }
  return join(dirname(resolved), "bin", "tsc");
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

/** Varsayılan argümanlar doğrulama koşusu; `scriptRuntimeReport` --version geçiyor. */
const TSC_ARGS = ["-p", "tsconfig.json", "--pretty", "false"];

function runTsc(cwd: string, args: string[] = TSC_ARGS): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tscBin(), ...args], {
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

      // tsc ayrıntılı hataları ÇOK SATIRLI basıyor: ilk satır konumu ve kodu
      // taşır, ardından girintili açıklama satırları gelir.
      //
      //   main.js(20,5): error TS2349: This expression is not callable.
      //     Type 'Boolean' has no call signatures.
      //
      // Ayrıştırıcı önce her satırın kendi başına bir tanı olduğunu varsayıyor
      // ve ikinci satırda istisna fırlatıyordu — CLI'ın ilk gerçek koşusunda
      // ortaya çıktı. Girintili satır önceki tanının mesajına ekleniyor;
      // açıklama çoğu zaman asıl bilgiyi taşıyor.
      if (/^\s/.test(line)) {
        const previous = errors.at(-1);
        if (previous !== undefined) {
          previous.message = `${previous.message} ${line.trim()}`;
          continue;
        }
        throw new Error(`tsc çıktısı çözümlenemedi (öncesinde tanı yok): ${line}`);
      }

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


/* ------------------------------------------------------------------------ *
 * Çalışma zamanı raporu — Aşama M1 (bkz. TODO.md)
 * ------------------------------------------------------------------------ */

/**
 * Tek bir ön koşulun ölçümü. `detail` hem yeşilde hem kırmızıda dolu:
 * yeşilde ne bulunduğu (yol, boyut, sürüm), kırmızıda hata mesajı.
 */
export type RuntimeCheck = { ok: boolean; detail: string; ms: number };

/** Kontrol adı -> sonuç. Sıra anlamlı: ucuzdan pahalıya, bağımlıdan bağımsıza. */
export type RuntimeReport = Record<string, RuntimeCheck>;

/**
 * Her kontrolü kendi try/catch'inde koşturur.
 *
 * Ayrı ayrı olması şart: tek bir "çalıştı/çalışmadı" cümlesi hangi ön koşulun
 * düştüğünü söylemiyor ve ilk hata sonrakileri ölçüsüz bırakıyor. Aşama M1'in
 * bitiş kriteri üç şeyi ayrı ayrı istiyor (süreç açma, geçici dizin, paketlenen
 * dosyalar); burada altıya ayrılmış hâli var.
 */
async function check(probe: () => Promise<string>): Promise<RuntimeCheck> {
  const started = performance.now();
  try {
    const detail = await probe();
    return { ok: true, detail, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      ms: Math.round(performance.now() - started),
    };
  }
}

/**
 * Native derleyici ikilisinin yolu.
 *
 * typescript@7 bir kabuk: bin/tsc 44 bayt ve lib/getExePath.js asıl derleyiciyi
 * @typescript/typescript-<platform>-<arch> paketinden çözüyor. Buradaki
 * çözümleme onun aynısı, sırası da tscBin() ile aynı gerekçeyle aynı: önce kök
 * node_modules, sonra require.resolve (ikincisi paketleyicide kırılıyor).
 */
function tscExePath(): string {
  const pkg = `typescript-${process.platform}-${process.arch}`;
  const bin = process.platform === "win32" ? "tsc.exe" : "tsc";

  const hoisted = join(ROOT, "node_modules", "@typescript", pkg, "lib", bin);
  if (existsSync(hoisted)) return hoisted;

  const resolved = require_.resolve(`@typescript/${pkg}/package.json`);
  if (typeof resolved !== "string") {
    throw new Error(
      `@typescript/${pkg} bulunamadı: require.resolve dosya yolu yerine ` +
        `${typeof resolved} döndürdü. Beklenen yol ${hoisted}`,
    );
  }
  return join(dirname(resolved), "lib", bin);
}

/**
 * validateScript()'in ihtiyaç duyduğu her ön koşulu ayrı ayrı ölçer.
 *
 * Aşama M1 bunun için var: `validateScript` bir alt süreç açıyor, yazılabilir
 * bir geçici dizin istiyor ve data/ altındaki .d.ts dosyalarını okuyor.
 * Serverless bir ücretsiz kademede üçü de garanti değil ve hangisinin
 * düştüğünü tek bir 500 yanıtından anlamak mümkün değil.
 *
 * Kasten `validateScript` ile AYNI yolları kullanıyor (`ROOT`, `tscBin`,
 * `resolveModules`, `tmpdir`) — ayrı bir yol ölçseydi yeşil sonuç asıl
 * fonksiyon hakkında bir şey söylemezdi.
 *
 * SINIR: `ROOT` modül yüklenirken hesaplanıyor. Kök hiç çözülemezse bu dosya
 * import edilemez ve rapor hiç koşmaz — çağıran taraf 500 alır. O durumda
 * teşhis hata mesajının kendisidir ("Repo kökü bulunamadı"), aşağıdaki `root`
 * kontrolü değil.
 */
export async function scriptRuntimeReport(): Promise<RuntimeReport> {
  const report: RuntimeReport = {};

  report["root"] = await check(async () => {
    const markers = MARKERS.map(
      (name) => `${name}=${existsSync(join(ROOT, name)) ? "var" : "YOK"}`,
    ).join(" ");
    const override = process.env["CODECRAFT_ROOT"];
    return (
      `ROOT=${ROOT} ${markers} ` +
      `CODECRAFT_ROOT=${override === undefined || override.trim() === "" ? "ayarsız" : override} ` +
      `cwd=${process.cwd()} platform=${process.platform}-${process.arch} node=${process.version}`
    );
  });

  report["data"] = await check(async () => {
    const { version, paths, modules } = await resolveModules({});
    const sizes: string[] = [];
    for (const [name, file] of Object.entries(paths)) {
      const { size } = await stat(file);
      sizes.push(`${name}@${modules[name]} ${size} bayt`);
    }
    return `sürüm=${version} ${sizes.join(" | ")}`;
  });

  report["tmpdir"] = await check(async () => {
    const dir = await mkdtemp(join(tmpdir(), "codecraft-probe-"));
    try {
      await writeFile(join(dir, "probe.txt"), "codecraft", "utf8");
      return `${tmpdir()} yazılabilir (${dir})`;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  report["tscShim"] = await check(async () => {
    const bin = tscBin();
    const { size } = await stat(bin);
    return `${bin} (${size} bayt)`;
  });

  // Asıl derleyici burada. Paketlenmemişse veya exec biti düşmüşse spawn
  // kontrolü de düşer; bu kontrol ikisini birbirinden ayırır.
  //
  // İkilinin varlığı YETMİYOR: tsgo standart kütüphaneyi kendi yanındaki
  // lib/ dizininden okuyor ve lib.d.ts yoksa çalışmıyor, panik ediyor
  // ("bundled: .../lib.d.ts does not exist; this executable may be
  // misplaced"). Paketleyici ikiliyi alıp .d.ts'leri bırakabiliyor, o yüzden
  // ikisi ayrı ayrı kontrol ediliyor.
  report["tscExe"] = await check(async () => {
    const exe = tscExePath();
    const { size } = await stat(exe);

    const libDts = join(dirname(exe), "lib.d.ts");
    if (!existsSync(libDts)) {
      throw new Error(
        `${exe} var ama yanındaki lib.d.ts yok (${libDts}). tsgo standart ` +
          "kütüphanesiz panik eder; ikili ile lib.*.d.ts dosyaları ayrılamaz.",
      );
    }

    let exec: string;
    try {
      await access(exe, constants.X_OK);
      exec = "exec izni var";
    } catch {
      exec = "EXEC İZNİ YOK";
    }
    return `${exe} (${size} bayt) lib.d.ts var ${exec}`;
  });

  // Tek başına hem süreç açmayı hem native ikiliyi çalıştırmayı kanıtlar.
  report["spawn"] = await check(async () => {
    const { code, output } = await runTsc(ROOT, ["--version"]);
    const line = output.trim().split(NEWLINE_RE)[0]?.trim() ?? "";
    if (code !== 0) {
      throw new Error(`tsc --version ${code} koduyla çıktı: ${output.trim()}`);
    }
    return `${line} (exit ${code})`;
  });

  return report;
}
