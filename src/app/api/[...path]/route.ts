import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { hasTraversal, isBlockedProxyPath } from "../../../lib/proxy-guard";

// Identity injection happens server-side; force the Node runtime for crypto.
export const runtime = "nodejs";

function apiOrigin(): string {
  const port = process.env.API_PORT ?? process.env.NEXT_PUBLIC_API_PORT ?? "8080";
  return process.env.API_URL ?? process.env.INTERNAL_API_URL ?? `http://127.0.0.1:${port}`;
}

/**
 * Mint the short-lived HMAC identity token the backend trusts. Must match
 * `signIdentityToken` in backend/services/api/src/auth.ts. Only this server-side proxy
 * holds INTERNAL_PROXY_SECRET, so the browser cannot forge an identity.
 */
function identityTtlSeconds(): number {
  const raw = Number(process.env.INTERNAL_IDENTITY_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 300;
}

function signIdentity(sub: string, email: string | null | undefined, secret: string): string {
  const body = { sub, email: email ?? undefined, exp: Math.floor(Date.now() / 1000) + identityTtlSeconds() };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  return `${json}.${sig}`;
}

/**
 * Sign the {ip, country} the proxy resolved so the backend can trust it as the
 * authenticated-edge geo/IP signal. Must match `verifyProxyContext` in
 * backend/services/api/src/auth.ts. The browser cannot forge this (no secret).
 */
function signProxyContext(
  ctx: { ip?: string; country?: string },
  secret: string,
): string {
  const body = { ip: ctx.ip, country: ctx.country, exp: Math.floor(Date.now() / 1000) + identityTtlSeconds() };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret).update(json).digest("base64url");
  return `${json}.${sig}`;
}

/**
 * Resolve the client's IP + country ONLY from a source the proxy actually trusts,
 * declared via `PROXY_TRUSTED_EDGE`. A browser-supplied `cf-ipcountry` /
 * `x-forwarded-for` is NEVER trusted here — that was the geo-bypass hole.
 *
 *   - `none` (default): no trusted edge (e.g. a bare `next start`). No country is
 *     asserted, so the backend geo gate fails CLOSED. Deploy behind a real edge
 *     (below) or a server-side GeoIP resolver before enabling geo enforcement.
 *   - `cloudflare`: trust `cf-ipcountry` / `cf-connecting-ip` — valid ONLY when
 *     Cloudflare sits in front and the origin is not reachable directly.
 *   - `vercel`: trust `x-vercel-ip-country` / `x-real-ip`.
 *   - `xff`: trust the leftmost `x-forwarded-for` entry as the IP (no country);
 *     use only behind a trusted LB that overwrites XFF.
 */
function resolveTrustedContext(request: NextRequest): { ip?: string; country?: string } {
  const edge = (process.env.PROXY_TRUSTED_EDGE ?? "none").toLowerCase();
  const h = (name: string) => request.headers.get(name)?.trim() || undefined;
  switch (edge) {
    case "cloudflare":
      return { ip: h("cf-connecting-ip"), country: h("cf-ipcountry")?.toUpperCase() };
    case "vercel":
      return {
        ip: h("x-real-ip") ?? h("x-vercel-forwarded-for")?.split(",")[0]?.trim(),
        country: h("x-vercel-ip-country")?.toUpperCase(),
      };
    case "xff":
      return { ip: h("x-forwarded-for")?.split(",")[0]?.trim(), country: undefined };
    default:
      return {};
  }
}

/**
 * Reject cross-site state-changing requests (X-8). Session auth rides on a cookie,
 * so a POST/PUT/PATCH/DELETE triggered from another origin would otherwise carry
 * the victim's session (CSRF). We defend in depth:
 *   - `Sec-Fetch-Site` must be same-origin/same-site when the browser sends it;
 *   - any `Origin` header must match the Host the request arrived on.
 * Programmatic API-key callers (HMAC, no ambient cookies) are exempt.
 */
function isForbiddenCrossSite(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  if (request.headers.get("x-api-key")) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (!host || new URL(origin).host !== host) return true;
    } catch {
      return true; // malformed Origin
    }
  }
  return false;
}

async function proxyRequest(request: NextRequest, path: string): Promise<NextResponse> {
  if (hasTraversal(path) || isBlockedProxyPath(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (isForbiddenCrossSite(request)) {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }
  const search = request.nextUrl.search;
  const target = `${apiOrigin()}${path}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  // NOTE: `x-account-party`, `x-account-email`, `x-proxy-identity`, and
  // `x-admin-key` are deliberately NOT forwarded from the browser — identity and
  // privileged keys are established server-side below. API-key auth (HMAC) headers
  // are forwarded as-is for programmatic clients.
  for (const name of [
    "x-api-key",
    "x-timestamp",
    "x-nonce",
    "x-signature",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Inject a signed identity for the authenticated end-user session. The
  // backend resolves the trading account from this verified subject and never
  // trusts a client-supplied party.
  // Use `||` (not `??`) so a blank env value falls back instead of being treated
  // as a configured empty secret — must match the backend's resolution in auth.ts.
  const proxySecret = process.env.INTERNAL_PROXY_SECRET || process.env.SESSION_SECRET;
  if (proxySecret) {
    const session = await auth();
    if (session?.user?.id) {
      headers.set("x-proxy-identity", signIdentity(session.user.id, session.user.email, proxySecret));
    }
    // Always vouch for the network context (even pre-auth) so the backend's geo
    // gate has a trustworthy, non-spoofable region/IP for EVERY request.
    headers.set("x-proxy-context", signProxyContext(resolveTrustedContext(request), proxySecret));
  }

  // Solver + maker routes authenticate via the user's session (which carries the
  // solver scope) or a per-account API key. There is NO shared solver credential
  // to inject — a single API key with the solver scope both posts and fills intents.

  // NOTE: we deliberately do NOT forward the browser's `cf-ipcountry` /
  // `x-forwarded-for`. Region/IP travel ONLY inside the signed `x-proxy-context`
  // above, so a client cannot spoof its jurisdiction by setting a header.

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      {
        error: "API unavailable. Run `pnpm all` in the intent-swap directory.",
      },
      { status: 503 },
    );
  }

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyRequest(request, `/${path.join("/")}`);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyRequest(request, `/${path.join("/")}`);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyRequest(request, `/${path.join("/")}`);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyRequest(request, `/${path.join("/")}`);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyRequest(request, `/${path.join("/")}`);
}
