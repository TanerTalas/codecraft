/**
 * Test yardımcıları — sahte model cevabı kurma.
 *
 * Tek yerde durmasının sebebi tip bağı: LanguageModelV4GenerateResult
 * @ai-sdk/provider içinde ve "ai" paketi onu dışa açmıyor. Bağ burada
 * tutulunca sağlayıcı arayüzü değiştiğinde tek dosya güncellenir.
 */
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";

/**
 * Modelin tek metin bloğu döndüren cevabı.
 *
 * finishReason ve usage'ın şekli sağlayıcı arayüzünden alındı, hatırlanmadı:
 * finishReason bir nesne ({ unified, raw }) ve token sayıları da nesne
 * (girdi tarafında önbellek kırılımı var). Düz sayı vermek çalışma zamanında
 * sessizce geçiyordu, tip bağı bunu görünür kıldı.
 */
export const textResponse = (text: string): LanguageModelV4GenerateResult => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: undefined },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
  warnings: [],
});
