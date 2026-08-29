/**
 * Küçük bir tar okuyucu. Sadece npm tarball'larını açmak için var.
 *
 * Üçüncü taraf bağımlılık eklememek ve sistemde `tar` bulunduğunu varsaymamak
 * için elle yazıldı. Girdi bizim kontrolümüzde: registry.npmjs.org'un ürettiği
 * ustar arşivleri. Genel amaçlı bir tar çözücü değil.
 */
import { gunzipSync } from "node:zlib";

const BLOCK = 512;

const readString = (block: Buffer, offset: number, length: number): string => {
  const end = block.indexOf(0, offset);
  const stop = end === -1 || end > offset + length ? offset + length : end;
  return block.toString("utf8", offset, stop);
};

const readOctal = (block: Buffer, offset: number, length: number): number => {
  const text = readString(block, offset, length).trim();
  return text === "" ? 0 : Number.parseInt(text, 8);
};

/** pax genişletilmiş başlığı: "<uzunluk> <anahtar>=<değer>\n" kayıtları. */
function readPaxPath(data: Buffer): string | null {
  for (const record of data.toString("utf8").split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

/** Gzip'li tar arşivini açar. Anahtar: arşiv içindeki yol, değer: dosya içeriği. */
export function extractTarGz(archive: Buffer): Map<string, Buffer> {
  const tar = gunzipSync(archive);
  const files = new Map<string, Buffer>();
  let override: string | null = null;
  let offset = 0;

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    offset += BLOCK;
    if (header.every((byte) => byte === 0)) break; // arşiv sonu

    const size = readOctal(header, 124, 12);
    const type = readString(header, 156, 1);
    const body = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / BLOCK) * BLOCK;

    if (type === "x" || type === "X") {
      override = readPaxPath(body);
      continue;
    }
    if (type === "L") {
      override = body.toString("utf8").replace(/\0+$/, "");
      continue;
    }
    if (type !== "" && type !== "0") {
      override = null;
      continue; // klasör, sembolik bağ, GNU meta kaydı — gerek yok
    }

    const prefix = readString(header, 345, 155);
    const name = readString(header, 0, 100);
    files.set(override ?? (prefix === "" ? name : `${prefix}/${name}`), body);
    override = null;
  }

  return files;
}
