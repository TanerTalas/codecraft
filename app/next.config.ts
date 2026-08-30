import { join } from "node:path";

import type { NextConfig } from "next";

const config: NextConfig = {
  // @codecraft/* ham TypeScript olarak yayınlanıyor (derleme adımı yok, göreli
  // import'larda .ts uzantısı zorunlu), o yüzden Next'in hepsini kendi
  // derlemesine alması gerekiyor.
  //
  // `serverExternalPackages` denendi ve İŞE YARAMADI: Turbopack workspace
  // sembolik bağlarını proje kaynağı sayıp yine de paketliyor. Bu yüzden
  // paketlenmeye dayanıklı olmak paketlerin kendi işi — bkz.
  // packages/knowledge/src/paths.ts.
  transpilePackages: ["@codecraft/core", "@codecraft/validator", "@codecraft/knowledge"],

  // Doğrulama iki şeyi ÇALIŞMA ZAMANINDA dinamik yolla okuyor: data/ altındaki
  // şemalar ve tip tanımları, ve typescript'in bin/tsc ikilisi. Next bunları
  // statik olarak izleyemiyor — `next build` zaten uyarıyor — o yüzden
  // fonksiyon paketine elle dahil ediliyorlar. Aksi hâlde yerelde çalışıp
  // dağıtımda ENOENT veren bir uç nokta çıkardı.
  outputFileTracingRoot: join(import.meta.dirname, ".."),
  outputFileTracingIncludes: {
    "/api/context": ["../data/**"],
    "/api/review": ["../data/**", "../node_modules/typescript/**"],
  },
};

export default config;
