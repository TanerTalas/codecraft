/**
 * Araçların ortak iskeleti.
 *
 * NEDEN `register` METODU, DÜZ BİR NESNE DEĞİL: SDK'nın `registerTool`'u girdi
 * şemasından dönüş tipini çıkarıyor (generic). Sekiz aracı tek bir dizide
 * tutup döngüyle kaydetmeye çalışınca dizinin eleman tipi birleşim oluyor ve
 * çıkarım çöküyor — her aracın `run`'ı kendi şemasını görmez olurdu. Her araç
 * kendini kaydedince çıkarım aracın içinde, somut tiplerle kalıyor.
 *
 * Dizi yine de adlarıyla dışarıda duruyor: hem createServer hem test aynı
 * listeye bakıyor, "kaydedildi ama listelenmiyor" hatası ölçülebilsin.
 */
import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolModule = {
  /** MCP'de görünen ad. Testte liste bununla karşılaştırılıyor. */
  name: string;
  register: (server: McpServer) => void;
};

/**
 * Sürüm parametresi — her araçta aynı biçim.
 *
 * Sarmalanan fonksiyonlar bunu ÜÇ ayrı şekilde alıyor: zorunlu konumsal
 * (`review`), opsiyonel konumsal (`resolveType`, `schemaFormatVersions`), ya
 * da options nesnesi içinde (`buildContext`, `validateScript`, `lookup`).
 * Bu tutarsızlık araç yüzeyine taşınmıyor; modele tek bir alan gösteriliyor.
 */
export const versionField = z
  .string()
  .optional()
  .describe(
    "Game version under data/, e.g. 1.26.40 or 1.26.40.5. " +
      "Defaults to the newest available version. Marketing numbers (26.40) are rejected.",
  );

/**
 * Salt okunur araç açıklaması.
 *
 * Sekiz aracın hepsi salt okunur: dosya yazmıyor, dışarı istek atmıyor,
 * yalnızca data/ okuyor. `openWorldHint: false` da bunun parçası — araç kapalı
 * bir veri kümesine bakıyor, internete değil.
 */
export const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
