import type { MetadataRoute } from "next";

/**
 * Web app manifest. `robots.ts` ve `sitemap.ts` ile aynı desen: dosya olarak
 * değil rota olarak duruyor, çünkü metin `site.ts`teki kaynakla aynı olmalı
 * ve elle tutulan ikinci bir kopya bayatlar.
 *
 * Üretici (realfavicongenerator, 05-09-2026) bir `site.webmanifest` de
 * veriyordu; üç değeri düzeltilerek buraya taşındı:
 *
 *   1. `purpose: "maskable"` → `"any"`. Maskable, ikonun içeriğinin güvenli
 *      bölgede (kenardan %10 içeride) durduğunu TAAHHÜT eder; Android o söze
 *      güvenip görseli daire/squircle'a kırpar. 512'lik görsel ölçüldü
 *      (05-09-2026): küpün köşeleri tuvalin 8. pikseline kadar geliyor,
 *      yani güvenli bölge yok. "maskable" bırakılsaydı köşeler kesilirdi.
 *
 *   2. `theme_color`/`background_color` `#ffffff` idi — üreticinin
 *      varsayılanı, sitenin rengi değil. Değerler `globals.css` ile aynı:
 *      `--stone-deep` üstbilgi bandı, `--sand` sayfa zemini.
 *
 *   3. İkon yolları `/web-app-manifest-<boyut>x<boyut>.png` idi. Boyut zaten
 *      `sizes` alanında yazıyor, dosya adında ikinci kez tekrar etmesi
 *      gereksiz — `public/icon-<boyut>.png` olarak duruyorlar.
 *
 * `description` başlıktaki cümlenin kısası: manifest açıklaması mağaza/kurulum
 * arayüzünde tek satır gösteriliyor, meta description uzunluğu oraya sığmıyor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CodeCraft",
    short_name: "CodeCraft",
    description:
      "An MCP server that checks whether Minecraft Bedrock content will actually load.",
    start_url: "/",
    display: "standalone",
    background_color: "#cfc6b6",
    theme_color: "#6f685c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
