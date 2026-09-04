import type { MetadataRoute } from "next";

import { SITE_URL } from "@/content/site";

/**
 * Dört sayfa da tam izinli. `/mcp` kapalı: GET'e 405 dönen bir MCP ucu,
 * taranacak bir sayfa değil.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/mcp" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
