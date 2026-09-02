/**
 * POST /mcp — MCP sunucusunun HTTP ucu.
 *
 * İnce kabuk (mimari kural 1). Bütün bağlantı mantığı
 * `packages/mcp/src/http.ts` içinde; gerekçesi orada yazılı, özeti: kök
 * tsconfig `app/` dizinini kapsamıyor, yani burada duran kod
 * `npm run typecheck`'e girmiyor ve M1'de tam bu yüzden bir dosya sessizce
 * çürüdü. Burada yalnızca Next'in beklediği yüzey duruyor.
 *
 * GET ve DELETE bilerek bağlı: `handleMcpRequest` ikisine de 405 döndürüyor.
 * Bağlanmasalardı Next'in kendi 405'i HTML dönerdi; MCP istemcisi JSON bekler.
 *
 * DOSYA İZLEME: Next izlemeyi rota başına yapıyor, yani bu rota kendi
 * fonksiyon paketini alıyor. data/, repo kökü işaretçileri ve tsc'nin ona
 * elle dahil edilmesi gerekiyor — `next.config.ts` içindeki `/mcp` girdisi.
 */
import { handleMcpRequest } from "@codecraft/mcp";

export const runtime = "nodejs";

// validate_script tsc'yi alt süreç olarak açıyor, derleme 60 sn'yi bulabilir.
export const maxDuration = 60;

export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;
