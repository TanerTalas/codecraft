/**
 * GET /api/config — sağlayıcı, varsayılan model ve sürüm listesi.
 *
 * Anahtar DÖNMEZ ve sunucu anahtarı hiç görmez (mimari kural 2). `loadConfig`
 * zaten gizli anahtar içeren bir alanı reddediyor, yani buradan sızacak bir
 * alan tanım gereği yok.
 */
import { listDataVersions, loadConfig } from "@codecraft/core";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const config = await loadConfig();
  const versions = await listDataVersions();

  return Response.json({
    provider: config.provider,
    model: config.model,
    versions,
  });
}
