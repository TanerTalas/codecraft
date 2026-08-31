/**
 * get_version_info — sürüm ve şema bağlamı (Aşama M2).
 *
 * Altı aracın ilki ve en ucuzu: alt süreç açmıyor, büyük bir indeks
 * döndürmüyor. M2'de tek başına duruyor çünkü işi araç yazmak değil, MCP
 * SDK'sının bu repoya gerçekten oturduğunu ÖLÇMEK — bir araç uçtan uca
 * çalışmadan "iskelet hazır" cümlesi bir şey söylemiyor.
 *
 * Neden buildContext: CodeCraft'ın var olma sebebi bu tablo. Bedrock'ta beş
 * ayrı sürüm biçimi dolaşıyor (CLAUDE.md) ve model hangisinin nereye
 * yazıldığını bilmeden üretim yapıyor. buildContext o beşini birbirinden
 * ayrılmış hâlde veriyor: min_engine_version üç parçalı dizi, modül sürümleri
 * ayrı, format_version tipe özel ve ÖLÇÜLMÜŞ.
 *
 * request parametresi yok, boş dize geçiliyor: buildContext bu argümanı
 * yalnızca collectIdentities'e veriyor ve o boş dizede hiçbir kimlik
 * bulamayıp [] döndürüyor (packages/core/src/context.ts). Kimlik doğrulaması
 * lookup_block'un işi (Aşama M3), bu aracın değil.
 */
import { z } from "zod";

import { buildContext } from "@codecraft/core/server";

/**
 * Sürüm parametresi tek biçim: her araçta opsiyonel bir `version` dizesi.
 *
 * Sarmalanan fonksiyonlar bunu üç ayrı şekilde alıyor — zorunlu konumsal,
 * opsiyonel konumsal, ya da options nesnesi içinde. Bu tutarsızlık araç
 * yüzeyine taşınmıyor; modele tek bir alan gösteriliyor.
 */
export const versionInput = {
  version: z
    .string()
    .optional()
    .describe(
      "data/ altındaki oyun sürümü, örn. 1.26.40 veya 1.26.40.5. " +
        "Verilmezse en yeni sürüm kullanılır. Pazarlama numarası (26.40) geçersiz.",
    ),
};

export const getVersionInfo = {
  name: "get_version_info",
  config: {
    title: "Bedrock sürüm ve şema bağlamı",
    description:
      "Bu sürümde hangi sürüm numarasının nereye yazıldığını döndürür: " +
      "min_engine_version (üç parçalı dizi), @minecraft/server modül sürümleri, " +
      "her belge tipi için geçerli format_version değerleri, ve tanınan belge " +
      "tiplerinin listesi. format_version oyun sürümünden bağımsız bir eksendir.",
    inputSchema: versionInput,
    // Salt okunur: dosya yazmıyor, dışarı istek atmıyor, data/'yı okuyor.
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  run: async ({ version }: { version?: string }) => {
    const context = await buildContext("", { version });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(context, null, 2) }],
    };
  },
};
