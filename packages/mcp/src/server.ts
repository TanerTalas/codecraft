/**
 * MCP sunucusunun kurulumu (Aşama M2, araçlar M3).
 *
 * TRANSPORT BURADA YOK ve olmayacak. Yerleşim kararı (TODO.md): araç mantığı
 * bu workspace'te, transport mevcut Next uygulamasında
 * `app/src/app/mcp/route.ts` olarak (Aşama M4). Mimari kural 1'in aynısı —
 * mantık çekirdekte, arayüz ince kabuk. createServer() bir McpServer
 * döndürüyor, ona neyin bağlanacağına çağıran karar veriyor: uçta HTTP
 * transport'u, testte SDK'nın in-memory transport'u.
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
