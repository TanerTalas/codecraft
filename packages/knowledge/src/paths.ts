/**
 * data/ klasörünün yeri. Tek yerden çözülür ki paket taşınınca kırılmasın.
 *
 * data/ git içinde durur ve veritabanı yoktur (CLAUDE.md, mimari kural 4) —
 * bu yüzden repo köküne göre sabit bir yol yeterli. Zor olan kısım "repo kökü
 * nerede" sorusunun paketlenmiş kodda da doğru cevaplanması.
 *
 * ÖNCEKİ HÂLİ `new URL("../../../", import.meta.url)` idi ve iki ayrı sebeple
 * paketleyici altında kırıldı (ölçüldü, Next 16.3.3 / Turbopack):
 *
 *   1. Paketleyici o ifadeyi bir modül referansı sanıyor ve derleme anında
 *      düşüyor: `Module not found: Can't resolve '../../../'`.
 *   2. Paketlense bile `import.meta.url` `.next/server/` altını gösterirdi,
 *      yani üç seviye yukarısı repo kökü OLMAZDI ve data/ sessizce bulunamazdı.
 *
 * Yerine yukarı doğru arama koyuldu: başlangıç noktası ister `packages/
 * knowledge/src/` olsun ister `app/.next/server/app/api/`, yukarı yürüyünce
 * aynı repo köküne çıkılıyor. `serverExternalPackages` denendi ve
 * ÇALIŞMADI — Turbopack workspace sembolik bağlarını proje kaynağı sayıyor,
 * o yüzden dışarıda bırakmıyor.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Kökü ele veren işaretçiler. İkisi de yalnızca birlikte kökte bulunur ve
 * ikisi de git içinde durur, yani dağıtımda da varlar.
 *
 * `package.json` TEK BAŞINA yetmez — her workspace'te bir tane var, yukarı
 * arama ilk rastladığı yerde dururdu. `data` ile birlikte kökü tekilleştiriyor.
 *
 * İkinci işaretçi önce `codecraft.config.json` idi ve o dosya LLM sağlayıcı
 * ayarlarını tutuyordu; asistan katmanı silinince dosya da gitti. Dağıtımda
 * izlenen dosya listesi buraya bağlı: `app/next.config.ts` içindeki
 * `outputFileTracingIncludes` ikisini de pakete almak zorunda, yoksa uç
 * modül yüklenirken "Repo kökü bulunamadı" ile düşer (31-08-2026'da ölçüldü).
 */
export const MARKERS: readonly string[] = ["data", "package.json"];

const isRoot = (dir: string): boolean => MARKERS.every((name) => existsSync(join(dir, name)));

function findRoot(start: string): string {
  let dir = start;
  // Sonsuz döngü yok: kök dizine varınca dirname kendini döndürür.
  for (;;) {
    if (isRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `The repository root was not found (searched upwards from ${start}). ` +
      `Markers looked for: ${MARKERS.join(", ")}. ` +
      "It can be set explicitly with the CODECRAFT_ROOT environment variable.",
  );
}

/** Repo kökü. Açık ayar varsa o, yoksa bu dosyadan yukarı arama. */
export const ROOT: string = (() => {
  const override = process.env["CODECRAFT_ROOT"];
  if (override !== undefined && override.trim() !== "") return resolve(override);
  return findRoot(dirname(fileURLToPath(import.meta.url)));
})();

export const DATA_DIR = join(ROOT, "data");
