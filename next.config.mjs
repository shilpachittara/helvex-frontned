import nextEnv from "@next/env";
import {
  REPO_ROOT,
  applyRootEnv,
  getResolvedEnv,
  nextPublicEnvKeys,
} from "./scripts/load-root-env.mjs";

// Single source of truth for the UI: frontend/.env.
// @next/env is CommonJS, so import the default export and destructure.
const { loadEnvConfig } = nextEnv;
loadEnvConfig(REPO_ROOT);
// Loads ALL keys (incl. server-only secrets like AUTH_SECRET, GOOGLE_CLIENT_SECRET,
// ADMIN_API_KEY) into process.env for server-side code (next-auth, route handlers).
applyRootEnv();

const env = getResolvedEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@intent-swap/domain"],
  // SECURITY: only NEXT_PUBLIC_* values belong here. Anything placed in `env`
  // is inlined into the client bundle wherever referenced, so server secrets
  // (AUTH_SECRET, GOOGLE_CLIENT_SECRET, ADMIN_API_KEY, INTERNAL_PROXY_SECRET)
  // are intentionally NOT listed — they stay in process.env, server-side only.
  env: {
    ...nextPublicEnvKeys(env),
  },
  async headers() {
    // Defense-in-depth response headers. CSP is intentionally conservative but
    // allows the inline styles/scripts Next.js needs; tighten with nonces later.
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "img-src 'self' data: https:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
