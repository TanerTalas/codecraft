/**
 * Üstbilgi: logo, ad, uç adresi kutusu ve sekmeler.
 * Karşılığı tasarım kanvasının üstbilgi bandıydı (kanvas silindi 04-09-2026).
 */

import Link from "next/link";

import { CopyEndpoint } from "@/components/CopyEndpoint";
import { Nav } from "@/components/Nav";
import { PixelCube } from "@/components/PixelCube";
import { ENDPOINT } from "@/content/site";

export function Header() {
  return (
    <header className="hd">
      <div className="hd-in">
        <div className="hd-top">
          <Link href="/" className="hd-brand">
            <PixelCube size={46} />
            <span className="hd-names">
              <span className="hd-name pixel">CodeCraft</span>
              <span className="hd-tag">
                MCP server · validation &amp; data lookup for Bedrock
              </span>
            </span>
          </Link>
          <div className="ep">
            <code>{ENDPOINT}</code>
            <CopyEndpoint />
          </div>
        </div>
        <Nav />
      </div>
    </header>
  );
}
