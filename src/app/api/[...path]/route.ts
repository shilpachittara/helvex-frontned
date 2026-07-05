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

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

function clientCountry(request: NextRequest): string | undefined {
  // Trust ONLY headers the edge/CDN sets and overwrites on every request.
  // `x-country-code` is a client-spoofable header and is deliberately NOT used
  // here so a browser cannot forge its region to bypass the geo gate.
  return (
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-vercel-ip-country") ??
    undefined
  );
}

async function proxyRequest(request: NextRequest, path: string): Promise<NextResponse> {
  if (hasTraversal(path) || isBlockedProxyPath(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  }

  // Solver + maker routes authenticate via the user's session (which carries the
  // solver scope) or a per-account API key. There is NO shared solver credential
  // to inject — a single API key with the solver scope both posts and fills intents.

  headers.set("x-forwarded-for", clientIp(request));
  const country = clientCountry(request);
  if (country) headers.set("cf-ipcountry", country.toUpperCase());

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
