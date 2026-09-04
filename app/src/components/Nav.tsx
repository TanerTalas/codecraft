"use client";

/**
 * Üstbilgi sekmeleri.
 *
 * Tasarımda dört `<button>` idi ve sayfa değişimi React durumuyla yapılıyordu
 * (tasarım kanvası, silindi 04-09-2026). Dört gerçek rotaya geçildiği
 * için `<Link>` oldu: tarayıcı geçmişi, orta tık ve tarayıcı robotu artık
 * çalışıyor.
 *
 * İstemci bileşeni olmasının tek sebebi `usePathname` — işaretlenen sekmeyi
 * seçmek için. Bağlantıların kendisi sunucuda render edilen HTML'de duruyor.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/setup", label: "Setup" },
  { href: "/tools", label: "Tools" },
  { href: "/limits", label: "Limits & data" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Site">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className="tab"
            aria-current={active ? "page" : undefined}
          >
            {l.label}
            {active ? <span className="tab-mark" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
