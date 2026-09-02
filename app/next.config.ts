import { join } from "node:path";

import type { NextConfig } from "next";

/**
 * data/ altından fonksiyon paketine giren dosyalar.
 *
 * Önce `../data/**` yazıyordu, yani KLASÖRÜN TAMAMI. Ölçüldü (02-09-2026):
 * çalışma zamanında okunmayan 11 MB ham Mojang şeması ve 4,3 MB Blockception
 * kaynağı da paketleniyordu. `packages/*` içinde `schemas/`, `schemas-index`
 * ve `release-notes` için SIFIR referans var; doğrulama Blockception'ın
 * DERLENMİŞ çıktısını kullanıyor (`schema-map.json` →
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
  transpilePackages: ["@codecraft/mcp", "@codecraft/validator", "@codecraft/knowledge"],

  // Doğrulama üç şeyi ÇALIŞMA ZAMANINDA dinamik yolla okuyor: data/ altındaki
  // şemalar ve tip tanımları, repo kökünü belli eden işaretçi dosyalar, ve
  // typescript derleyicisi. Next bunları statik olarak izleyemiyor —
  // `next build` zaten uyarıyor — o yüzden fonksiyon paketine elle dahil
  // ediliyorlar. Aksi hâlde yerelde çalışıp dağıtımda ENOENT veren bir uç
  // nokta çıkardı.
  //
  // İki girdi "gereksiz" görünüyor ama değil, ikisi de 31-08-2026'da ölçüldü:
  //
  //   ../package.json — knowledge/src/paths.ts'teki isRoot() İKİ işaretçiyi
  //     birden arıyor (`data` VE `package.json`). Yalnızca data/ paketlenirse
  //     ROOT modül yüklenirken çözülemiyor ve uç nokta daha ilk istekte
  //     "Repo kökü bulunamadı" ile düşüyor. (Ölçüm `codecraft.config.json`
  //     işaretçisiyle yapıldı; o dosya asistan katmanıyla birlikte silindi,
  //     kırığın mekanizması aynı.)
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
    // Tek fonksiyon paketi kaldı: MCP ucu. validate_script tsc'yi alt süreç
    // olarak açıyor, o yüzden dört yolun dördü de gerekiyor.
    "/mcp": [
      ...DATA_FILES,
      "../package.json",
      "../node_modules/typescript/**",
      "../node_modules/@typescript/**",
    ],
  },
};

export default config;
