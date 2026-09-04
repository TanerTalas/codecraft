"use client";

/**
 * Uç adresini panoya kopyalayan düğme.
 *
 * Tasarımdaki `copy()` metodunun karşılığı (tasarım kanvası, silindi
 * 04-09-2026): 1600 ms boyunca "Copied" yazıp geri dönüyor.
 *
 * Sitedeki iki istemci adasından biri. Metin taşımıyor — JavaScript
 * çalışmasa da yanındaki adres okunur durumda kalıyor.
 */

import { useEffect, useRef, useState } from "react";

import { ENDPOINT } from "@/content/site";

export function CopyEndpoint() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  function copy() {
    navigator.clipboard?.writeText(ENDPOINT).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className="btn-rust" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
