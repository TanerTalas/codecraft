import type { Metadata } from "next";
import { JetBrains_Mono, Silkscreen } from "next/font/google";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_URL } from "@/content/site";

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
    "An MCP server that checks whether Minecraft Bedrock content will actually load. Nine read-only tools for schema, command, script and pack validation. You bring the model.",
  applicationName: "CodeCraft",
  openGraph: {
    type: "website",
    siteName: "CodeCraft",
    title: "CodeCraft — MCP server for Minecraft Bedrock",
    description:
      "An MCP server that checks whether Minecraft Bedrock content will actually load. Nine read-only tools. You bring the model.",
  },
  twitter: { card: "summary" },
};

/** `lang="tr"` idi ve sitenin tamamı İngilizce — 04-09-2026'da düzeltildi. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${mono.variable}`}>
      <body>
        <div className="site">
          <Header />
          <main className="main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
