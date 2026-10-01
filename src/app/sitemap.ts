import type { MetadataRoute } from "next";
import { siteOrigin } from "../lib/site";

/** Public marketing/entry URLs only — not the authenticated trading desk. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const lastModified = new Date();
  return [
    {
      url: `${origin}/login`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${origin}/kyc`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: origin,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
