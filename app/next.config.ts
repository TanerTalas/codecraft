import { join } from "node:path";

import type { NextConfig } from "next";

/**
 * data/ altından fonksiyon paketine giren dosyalar.
 *
 * Önce `../data/**` yazıyordu, yani KLASÖRÜN TAMAMI. Ölçüldü (02-09-2026):
 * çalışma zamanında okunmayan 11 MB ham Mojang şeması ve 4,3 MB Blockception
 * kaynağı da paketleniyordu. `packages/*` ve `app/src` içinde `schemas/`,
 * `schemas-index` ve `release-notes` için SIFIR referans var; doğrulama
 * Blockception'ın DERLENMİŞ çıktısını kullanıyor (`schema-map.json` →
 * `index.sources.blockception.compiled`).
 *
 * Bu yalnızca boyut meselesi değil: uç herkese açık ve ham Mojang şemaları
 * Minecraft EULA'ya tabi. Okunmayan dosyayı üçüncü bir tarafa yüklememek
 * doğru taraf (`docs/SOURCES.md`).
 *
 * Sürüm klasörü adı GLOB ile geçiliyor — `1.26.40.5` sabitlenirse Mojang
 * sonraki sürümü yayınladığında paket sessizce boşalırdı.
 *
 * İlk glob hem `data/<sürüm>/` altındaki JSON indeksleri hem
 * `data/blockception/schema-map.json` dosyasını yakalıyor.
 */
const DATA_FILES = [
  "../data/*/*.json",
  "../data/*/script-types/**",
  "../data/blockception/compiled/**",
];

const config: NextConfig = {
  // @codecraft/* ham TypeScript olarak yayınlanıyor (derleme adımı yok, göreli
  // import'larda .ts uzantısı zorunlu), o yüzden Next'in hepsini kendi
  // derlemesine alması gerekiyor.
  //
  // `serverExternalPackages` denendi ve İŞE YARAMADI: Turbopack workspace
  // sembolik bağlarını proje kaynağı sayıp yine de paketliyor. Bu yüzden
  // paketlenmeye dayanıklı olmak paketlerin kendi işi — bkz.
  // packages/knowledge/src/paths.ts.
  transpilePackages: [
    "@codecraft/core",
    "@codecraft/validator",
    "@codecraft/knowledge",
    "@codecraft/mcp",
  ],

  // Doğrulama üç şeyi ÇALIŞMA ZAMANINDA dinamik yolla okuyor: data/ altındaki
  // şemalar ve tip tanımları, repo kökünü belli eden işaretçi dosya, ve
  // typescript derleyicisi. Next bunları statik olarak izleyemiyor —
  // `next build` zaten uyarıyor — o yüzden fonksiyon paketine elle dahil
  // ediliyorlar. Aksi hâlde yerelde çalışıp dağıtımda ENOENT veren bir uç
  // nokta çıkardı.
  //
  // İki girdi "gereksiz" görünüyor ama değil, ikisi de 31-08-2026'da ölçüldü
  // (Aşama M1):
  //
  //   codecraft.config.json — knowledge/src/paths.ts'teki isRoot() İKİ
  //     işaretçiyi birden arıyor (`data` VE `codecraft.config.json`). Yalnızca
  //     data/ paketlenirse ROOT modül yüklenirken çözülemiyor ve uç nokta daha
  //     ilk istekte "Repo kökü bulunamadı" ile düşüyor.
  //
  //   @typescript/** — typescript@7 bir kabuk paketi (3,2 MB), derleyici değil.
  //     bin/tsc 44 bayt; asıl derleyici platforma özel bir Go ikilisi
  //     (@typescript/typescript-<platform>-<arch>/lib/tsc, ~24,5 MB) ve
  //     lib/getExePath.js onu çalışma zamanında import.meta.resolve ile
  //     buluyor.
  //
  //     Next ikilinin KENDİSİNİ zaten izliyordu — eski yapılandırmayla alınan
  //     manifestte @typescript/ altından tam olarak 1 dosya vardı, tsc.exe.
  //     Eksik olan yanındaki lib.*.d.ts dosyalarıydı ve onlarsız ikili
  //     çalışmıyor, PANİK EDİYOR (ölçüldü, 31-08-2026):
  //
  //       panic: bundled: .../lib/lib.d.ts does not exist;
  //              this executable may be misplaced
  //
  //     tsgo standart kütüphaneyi ikilinin yanındaki lib/ dizininden okuyor,
  //     yani ikili ile o dosyalar ayrılamaz. Glob geniş görünse de npm
  //     yalnızca çalışılan platformun opsiyonel bağımlılığını kuruyor: Linux
  //     build'inde tek paket dahil oluyor, 20 tanesi değil.
  outputFileTracingRoot: join(import.meta.dirname, ".."),
  outputFileTracingIncludes: {
    "/api/context": [...DATA_FILES, "../codecraft.config.json"],
    "/api/review": [
      ...DATA_FILES,
      "../codecraft.config.json",
      "../node_modules/typescript/**",
      "../node_modules/@typescript/**",
    ],
    // /mcp AYRI bir fonksiyon paketi. Next izlemeyi rota başına yapıyor, yani
    // /api/review'un yeşili buraya taşınmıyor: validate_script aracı tsc'yi
    // burada da açıyor ve dört yolun dördü de tekrar gerekiyor. TODO'nun M4
    // maddesi yalnızca ikisini yazıyordu; eksik olan ikisi tam olarak M1'de
    // ölçülen iki kırığın sebebiydi (yukarıdaki blokta anlatılıyor).
    "/mcp": [
      ...DATA_FILES,
      "../codecraft.config.json",
      "../node_modules/typescript/**",
      "../node_modules/@typescript/**",
    ],
  },
};

export default config;
