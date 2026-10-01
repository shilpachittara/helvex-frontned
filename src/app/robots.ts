import type { MetadataRoute } from "next";
import { siteOrigin } from "../lib/site";

/**
 * Index public entry points only. Authenticated desk routes (/solver, /account)
 * and credential flows are disallowed — they require a session or one-time tokens.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/kyc"],
        disallow: [
          "/api/",
          "/admin/",
          "/account",
          "/solver",
          "/setup-password",
          "/forgot-password",
          "/reset-password",
          "/kyc/callback",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
