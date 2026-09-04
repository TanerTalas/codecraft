import type { MetadataRoute } from "next";

import { SITE_URL } from "@/content/site";

/** Dört rota. `/mcp` bilerek yok: o bir MCP ucu, sayfa değil. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/setup`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tools`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/limits`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
