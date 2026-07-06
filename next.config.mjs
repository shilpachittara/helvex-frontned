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
    const isProd = process.env.NODE_ENV === "production";

    // script-src: 'unsafe-eval' is only needed for dev HMR, so drop it in
    // production (removes a whole class of eval-based XSS). 'unsafe-inline' is
    // still required because Next injects inline hydration/bootstrap scripts and
    // we don't yet emit per-request nonces (see NONCE follow-up in
    // docs/SECURITY_AUDIT.md — needs a middleware-generated nonce + `strict-dynamic`,
    // verified against the rendered app before enabling).
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    // connect-src: same-origin covers all API traffic (the app talks to the
    // backend only through the same-origin /api proxy). The Loop wallet SDK may
    // reach external origins, so operators can widen this with a SPACE-separated
    // allowlist instead of the broad `https:`. Defaults stay permissive in dev.
    const extraConnect = (process.env.CSP_CONNECT_SRC ?? "").trim();
    const connectSrc = isProd
      ? `connect-src 'self'${extraConnect ? ` ${extraConnect}` : " https:"}`
      : "connect-src 'self' https: ws: wss:";

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
          scriptSrc,
          "style-src 'self' 'unsafe-inline'",
          connectSrc,
          "frame-ancestors 'none'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
