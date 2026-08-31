/**
 * get_version_info — sürüm ve şema bağlamı (Aşama M2).
 *
 * Sekiz aracın ilki ve en ucuzu: alt süreç açmıyor, büyük bir indeks
 * döndürmüyor. M2'de tek başına duruyordu çünkü oradaki iş araç yazmak değil,
 * MCP SDK'sının bu repoya gerçekten oturduğunu ÖLÇMEKTİ — bir araç uçtan uca
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
 * lookup_id'nin işi, bu aracın değil.
 */
import { buildContext } from "@codecraft/core/server";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const getVersionInfo: ToolModule = {
  name: "get_version_info",
  register: (server) => {
    server.registerTool(
      "get_version_info",
      {
        title: "Bedrock sürüm ve şema bağlamı",
        description:
          "Bu sürümde hangi sürüm numarasının nereye yazıldığını döndürür: " +
          "min_engine_version (üç parçalı dizi), @minecraft/server modül sürümleri, " +
          "her belge tipi için geçerli format_version değerleri, ve tanınan belge " +
          "tiplerinin listesi. format_version oyun sürümünden bağımsız bir eksendir. " +
          "Bir behavior pack dosyası yazmadan önce bunu çağır.",
        inputSchema: { version: versionField },
        annotations: READ_ONLY,
      },
      async ({ version }) => jsonResult(await buildContext("", { version })),
    );
  },
};
