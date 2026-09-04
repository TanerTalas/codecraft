/**
 * Üstbilgideki izometrik küp.
 *
 * Tasarımdaki `cube(size)` metodunun birebir karşılığı
 * (`docs/CodeCraft Site.dc.html`, satır 428-478): üç yüz, her yüzde köşe
 * çentikleri ve ortada 3x3 hücreli plaka. Ölçüler `size`'dan türetiliyor,
 * sabit yazılmıyor — tasarımda da öyleydi.
 *
 * Durumsuz, tamamen sunucuda render ediliyor. Dekoratif olduğu için
 * `aria-hidden`: taşıdığı bilgi yanındaki "CodeCraft" yazısında zaten var.
 */

import type { CSSProperties } from "react";

const TONE = {
  top: "#a8a094",
  front: "#8a8277",
  side: "#69625a",
  notch: "#4a443c",
  edge: "#26221f",
  plate: "#ded8cd",
  plateEdge: "#8a8277",
  well: "#b3aca0",
} as const;

const CELLS = ["r", "a", "r", "r", "r", "r", "g", "r", "r"] as const;
const CELL_COLOR: Record<string, string> = { r: "#a8322b", a: "#c98b2c", g: "#4f7a3a" };

export function PixelCube({ size = 46 }: { size?: number }) {
  const s = size;
  const half = s / 2;
  const bw = Math.max(2, Math.round(s / 26));
  const tiny = s < 40;

  const plate = Math.round(s * 0.56);
  const cell = Math.max(2, Math.round(plate * 0.2));

  function panel(shade?: number) {
    const style: CSSProperties = {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%,-50%)",
      width: plate,
      height: plate,
      background: TONE.plate,
      border: `${Math.max(2, Math.round(s / 30))}px solid ${TONE.plateEdge}`,
      boxShadow: `inset 0 0 0 ${Math.max(1, Math.round(s / 44))}px ${TONE.well}`,
      filter: shade ? `brightness(${shade})` : "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    return (
      <div style={style}>
        {tiny ? (
          <div style={{ width: cell * 2, height: cell * 2, background: "#a8322b" }} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(3,${cell}px)`,
              gap: Math.max(1, Math.round(cell * 0.45)),
            }}
          >
            {CELLS.map((c, i) => (
              <div key={i} style={{ width: cell, height: cell, background: CELL_COLOR[c] }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function notches(shade?: number) {
    const n = Math.round(s * 0.14);
    const small = Math.round(n * 0.6);
    const outer: CSSProperties[] = [
      { left: 0, top: 0 },
      { right: 0, top: 0 },
      { left: 0, bottom: 0 },
      { right: 0, bottom: 0 },
    ];
    const inner: CSSProperties[] = [
      { left: n, top: 0 },
      { right: n, bottom: 0 },
      { left: 0, top: n },
      { right: 0, bottom: n },
    ];

    return [
      ...outer.map((p, i) => (
        <div
          key={`n${i}`}
          style={{
            position: "absolute",
            width: n,
            height: n,
            background: TONE.notch,
            opacity: shade ? 0.5 : 0.38,
            ...p,
          }}
        />
      )),
      ...inner.map((p, i) => (
        <div
          key={`i${i}`}
          style={{
            position: "absolute",
            width: small,
            height: small,
            background: TONE.notch,
            opacity: 0.2,
            ...p,
          }}
        />
      )),
    ];
  }

  function face(key: string, bg: string, transform: string, shade?: number) {
    return (
      <div
        key={key}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: s,
          height: s,
          background: bg,
          border: `${bw}px solid ${TONE.edge}`,
          overflow: "hidden",
          transform,
        }}
      >
        {notches(shade)}
        {panel(shade)}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        flex: "none",
        width: s * 1.5,
        height: s * 1.8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: s * 7,
      }}
    >
      <div
        style={{
          position: "relative",
          width: s,
          height: s,
          transformStyle: "preserve-3d",
          transform: "rotateX(58deg) rotateZ(45deg)",
        }}
      >
        {face("t", TONE.top, `translateZ(${half}px)`)}
        {face("f", TONE.front, `rotateX(-90deg) translateZ(${half}px)`, 0.94)}
        {face("s", TONE.side, `rotateY(90deg) translateZ(${half}px)`, 0.82)}
      </div>
    </div>
  );
}
