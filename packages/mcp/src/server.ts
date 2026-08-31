/**
 * MCP sunucusunun kurulumu (Aşama M2, araçlar M3).
 *
 * TRANSPORT BU DOSYADA YOK ve olmayacak. createServer() bir McpServer
 * döndürüyor, ona neyin bağlanacağına çağıran karar veriyor: uçta HTTP
 * transport'u, testte SDK'nın in-memory transport'u.
 *
 * Bağlantı Aşama M4'te `src/http.ts` içine yazıldı (`handleMcpRequest`),
 * `app/src/app/mcp/route.ts` yalnızca onu dışa veren ince kabuk. TODO'nun M4
 * maddesi transport'u route dosyasına koyuyordu; sapmanın gerekçesi
 * `src/http.ts`'in başında — kök tsconfig `app/` dizinini kapsamıyor ve orada
 * duran kod `npm run typecheck`'e girmiyor.
 *
 * SÜRÜM NUMARASI — buradaki `version` SUNUCUNUN kendi sürümü, MCP protokol
 * sürümü değil, Bedrock sürümü hiç değil. Bedrock'ta zaten beş ayrı sürüm
 * biçimi dolaşıyor (CLAUDE.md); altıncısını karıştırmamak için burada
 * yazılı duruyor.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { checkFeasibilityTool } from "./tools/feasibility.ts";
import { getSchema } from "./tools/schema.ts";
import { getVersionInfo } from "./tools/version.ts";
import { lookupId } from "./tools/lookup.ts";
import { reviewPack } from "./tools/review.ts";
import { validateCommandTool } from "./tools/command.ts";
import { validateJsonTool } from "./tools/json.ts";
import { validateScriptTool } from "./tools/script.ts";
import type { ToolModule } from "./tool.ts";

/** Sunucunun kendi sürümü. package.json ile aynı, elle tutuluyor. */
export const SERVER_VERSION = "0.0.0";

/**
 * Kayıtlı araçlar. Sekizi de salt okunur; yazma işlemi yok.
 *
 * Sıra kullanım sırasını anlatıyor, alfabetik değil: önce yapılabilir mi, sonra
 * hangi sürüm ve hangi şema, sonra kimlik doğrulama, en sonda doğrulayıcılar.
 * `tools/list` bunu bu sırayla veriyor ve modelin okuduğu ilk şey bu.
 *
 * Dizi olarak duruyor ki hem createServer hem test aynı listeyi görsün —
 * "kaydedildi ama listelenmiyor" hatası ölçülebilsin.
 */
export const tools: ToolModule[] = [
  checkFeasibilityTool,
  getVersionInfo,
  getSchema,
  lookupId,
  validateJsonTool,
  validateCommandTool,
  validateScriptTool,
  reviewPack,
];

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "codecraft", version: SERVER_VERSION },
    {
      instructions:
        "Minecraft Bedrock için doğrulanmış çıktı üretmeye yarayan araçlar. " +
        "Sıra önemli: önce check_feasibility (istek Bedrock'ta yapılabilir mi), " +
        "sonra get_version_info ve get_schema (hangi alanlar zorunlu, " +
        "format_version ne olmalı), üretimden sonra review_pack. " +
        "Bedrock'un sürüm alanları birbirine karışıyor — format_version oyun " +
        "sürümü DEĞİL, o dosya tipinin kendi şema sürümü. Değerleri buradan al, " +
        "hatırladığından değil.",
    },
  );

  for (const tool of tools) tool.register(server);

  return server;
}
