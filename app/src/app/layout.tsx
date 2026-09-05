import type { Metadata } from "next";
import { JetBrains_Mono, Silkscreen } from "next/font/google";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { REPO, SITE_URL } from "@/content/site";

import "./globals.css";

/**
 * Tasarım kanvası fontları Google Fonts'tan `<link>` ile çekiyordu
 * (kanvas silindi 04-09-2026). `next/font` derleme anında
 * indirip kendi kendine barındırıyor: ziyaretçiden üçüncü tarafa hiç istek
 * gitmiyor. Sitenin kendi gizlilik iddiasıyla tutarlı olan taraf bu.
 */
const pixel = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CodeCraft — MCP server for Minecraft Bedrock",
    template: "%s · CodeCraft",
  },
  description:
    "An MCP server that checks whether Minecraft Bedrock content will actually load. Nine read-only tools for schema, command, script and pack validation.",
  applicationName: "CodeCraft",
  openGraph: {
    type: "website",
    siteName: "CodeCraft",
    title: "CodeCraft — MCP server for Minecraft Bedrock",
    description:
      "An MCP server that checks whether Minecraft Bedrock content will actually load. Nine read-only tools. You bring the model.",
  },
  // `summary` küçük kare kart demek. Görsel 1200x630 (ölçüldü 05-09-2026,
  // PNG başlığından), yani geniş kart formatı — `summary_large_image` olmazsa
  // paylaşımda kırpılıyor.
  //
  // Görselin kendisi `opengraph-image.png` dosya adıyla duruyor: Next bu adı
  // tanıyıp etiketleri kendisi üretiyor, elle URL yazılmıyor.
  //
  // ~~`twitter:image` ayrı bir dosya adı ister; yazılmadığında istemciler
  // `og:image`'a düşüyor.~~ YANLIŞ ÇIKTI, ölçüldü 05-09-2026 dağıtılmış
  // sayfada: Next `twitter-image` dosyası olmadan da `twitter:image`,
  // `twitter:image:type` ve `twitter:image:width/height` etiketlerini
  // `opengraph-image`'dan üretiyor. Yani ikinci bir kopya koymaya gerek yok —
  // koysaydık 200 KB'ı boşuna iki kere taşıyorduk.
  twitter: { card: "summary_large_image" },

  // `icons` ve `manifest` BURADA YOK, bilerek. Aynı dosya adı kuralı:
  // `favicon.ico`, `icon.png`, `icon.svg`, `apple-icon.png` ve `manifest.ts`
  // bu klasörde duruyor, Next beş `<link>` etiketini de onlardan üretiyor.
  // Elle yazılsaydı ikinci bir kaynak olurdu ve dosya adı değişince sessizce
  // 404 verirdi. Ölçüm: `docs/site-icerik.md`, "favicon seti".

  // Google Search Console "HTML etiketi" doğrulaması. Alan adı bizim değil
  // (`vercel.app` alt alanı), o yüzden DNS gerektiren "Alan adı" özelliği
  // değil "URL öneki" özelliği açıldı; onun kabul ettiği yöntem bu etiket.
  //
  // Gizli bir değer DEĞİL: doğrulama token'ı zaten sayfanın kaynağında
  // herkese açık duruyor, sahipliği kanıtlaması da tam bundan geliyor.
  verification: { google: "0y40gIGXeSAZCOIFhcOHM92NINPYV6YzAYaldxf77sU" },
};

/**
 * Yapısal veri (JSON-LD). Arama motoru "bu sayfa ne" sorusunu düz metinden
 * çıkarmak zorunda kalmasın diye.
 *
 * `aggregateRating` YOK ve eklenmeyecek. Google'ın SoftwareApplication zengin
 * sonucu puan istiyor; puanı olmayan bir şeye puan yazmak bu deponun tam
 * karşı durduğu şey. Yani buradaki amaç zengin sonuç değil, varlığın doğru
 * tanınması — ölçülmemiş bir iddia uğruna değiştirilmez.
 *
 * `softwareVersion` de bilerek yok: sürüm `packages/mcp/package.json` ile
 * `server.ts` arasında zaten testle bağlı, üçüncü bir elle senkron kopya
 * bayatlamaktan başka bir şey yapmaz.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "CodeCraft",
      description:
        "An MCP server that checks whether Minecraft Bedrock content will actually load.",
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "CodeCraft",
      url: SITE_URL,
      applicationCategory: "DeveloperApplication",
      // Uzak bir MCP ucu; istemci hangi işletim sisteminde koşarsa koşsun.
      operatingSystem: "Any",
      description:
        "A validation and data lookup MCP server for Minecraft Bedrock. Nine read-only tools check generated content against the official schemas, the command grammar and a real tsc, so a field name recalled wrong is caught before the pack reaches the game.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      sameAs: [REPO],
    },
  ],
};

/** `lang="tr"` idi ve sitenin tamamı İngilizce — 04-09-2026'da düzeltildi. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="site">
          <Header />
          <main className="main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
