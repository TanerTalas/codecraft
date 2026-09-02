// @codecraft/mcp — MCP araç katmanı.
//
// Bu paket ARAÇLARI, araçların gövdesini (`src/bedrock/`), sunucu kurulumunu
// ve HTTP yüzeyini taşır. `handleMcpRequest` durumsuz Streamable HTTP'yi
// kuruyor (`src/http.ts`); `app/src/app/mcp/route.ts` yalnızca onu dışa veren
// ince kabuk.
//
// BAĞIMLILIK SINIRI — bu paket bir LLM SDK'sına bağlanmaz. Modeli kullanıcı
// getiriyor; sunucu doğrular, üretmez. Kural laf olarak değil ölçüyle
// duruyor: `test/no-llm.test.ts`.

export { createServer, SERVER_VERSION, tools } from "./server.ts";
export { handleMcpRequest } from "./http.ts";
export { BYTE_LIMIT, byteLength, capText, jsonResult } from "./limit.ts";
export { READ_ONLY, versionField } from "./tool.ts";
export type { ToolModule } from "./tool.ts";
