"use client";

/**
 * Beş sürüm numarasının sekmeleri.
 *
 * Tasarımda yalnızca ETKİN panel render ediliyordu (`activeVersion`,
 * `docs/CodeCraft Site.dc.html` satır 269-276), yani beş sürüm numarasının
 * dördü HTML'de hiç yoktu — üstelik `CLAUDE.md`'ye göre bu, projenin en çok
 * can yakan konusu. Burada beşi de render ediliyor, etkin olmayanlar `hidden`
 * ile gizleniyor: görsel sonuç aynı, HTML beş olguyu da taşıyor.
 */

import { useState } from "react";

import { versions } from "@/content/site";

export function VersionTabs() {
  const [active, setActive] = useState(0);

  return (
    <>
      <div className="vtabs" role="tablist" aria-label="Version numbers">
        {versions.map((v, i) => (
          <button
            key={v.label}
            type="button"
            role="tab"
            id={`vtab-${i}`}
            aria-selected={active === i}
            aria-controls={`vpanel-${i}`}
            className="vtab"
            onClick={() => setActive(i)}
          >
            {v.label}
            {active === i ? <span className="vtab-mark" /> : null}
          </button>
        ))}
      </div>
      {versions.map((v, i) => (
        <div
          key={v.label}
          className="vpanel"
          role="tabpanel"
          id={`vpanel-${i}`}
          aria-labelledby={`vtab-${i}`}
          hidden={active !== i}
        >
          <div className="vpanel-h">{v.label}</div>
          <div className="vrow">
            <span className="vlab">Example</span>
            <code className="vex">{v.example}</code>
          </div>
          <div className="vwhere">
            <span className="vlab">Where it goes</span>
            <br />
            {v.where}
          </div>
        </div>
      ))}
    </>
  );
}
