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
        title: "Can Bedrock do this",
        description:
          "Checks whether a user request can be built with a behavior pack and the " +
          "@minecraft/server API. If it is blocked, returns why, the evidence behind " +
          "that rule, and a workable alternative. Call this BEFORE writing any code or " +
          "JSON: input simulation, file system access and network access do not exist " +
          "in the Bedrock scripting API, and those are the most commonly hallucinated " +
          "APIs.",
        inputSchema: {
          request: z
            .string()
            .min(1)
            .describe("The user request in their own words. Any language is accepted."),
        },
        annotations: READ_ONLY,
      },
      ({ request }) => jsonResult(checkFeasibility(request)),
    );
  },
};
