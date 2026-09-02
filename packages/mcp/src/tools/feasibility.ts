/**
 * check_feasibility — istek Bedrock'ta yapılabilir mi.
 *
 * NEDEN İLK ÇAĞRILMASI GEREKEN ARAÇ BU: kullanıcı isteğini oyuncu diliyle
 * söylüyor, platform bambaşka bir şey sunuyor. "Fareyi otomatik tıklat",
 * "dosyaya yaz", "şu siteden veri çek" — üçü de behavior pack script'iyle
 * yapılamaz ve model bunu bilmediğinde uydurulmuş API üretiyor. En sık hata bu.
 *
 * Kural tabanlı, LLM'siz, I/O'suz. Yakalandığında araç neden yapılamadığını,
 * dayandığı ölçümü ve alternatifi birden döndürüyor — üçü de
 * packages/core/src/feasibility.ts içinde testle sabitlenmiş.
 */
import { checkFeasibility } from "../bedrock/feasibility.ts";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, type ToolModule } from "../tool.ts";

export const checkFeasibilityTool: ToolModule = {
  name: "check_feasibility",
  register: (server) => {
    server.registerTool(
      "check_feasibility",
      {
        title: "İstek Bedrock'ta yapılabilir mi",
        description:
          "Kullanıcının isteğini behavior pack ve @minecraft/server API'siyle " +
          "yapılıp yapılamayacağına göre denetler. Engellenirse neden yapılamadığını, " +
          "kanıtını ve önerilen alternatifi döndürür. Kod veya JSON üretmeden ÖNCE " +
          "çağır: girdi simülasyonu, dosya sistemi ve ağ erişimi Bedrock script " +
          "API'sinde yok, ve bunlar en sık uydurulan API'ler.",
        inputSchema: {
          request: z
            .string()
            .min(1)
            .describe("Kullanıcının isteği, kendi cümlesiyle. Türkçe veya İngilizce."),
        },
        annotations: READ_ONLY,
      },
      ({ request }) => jsonResult(checkFeasibility(request)),
    );
  },
};
