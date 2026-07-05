import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";

// Identity/authorization is resolved server-side; force the Node runtime.
export const runtime = "nodejs";

/** Constant-time equality; false if either side is missing or lengths differ. */
function secretEquals(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function apiOrigin(): string {
  const port = process.env.API_PORT ?? process.env.NEXT_PUBLIC_API_PORT ?? "8080";
  return process.env.API_URL ?? process.env.INTERNAL_API_URL ?? `http://127.0.0.1:${port}`;
}

/** Operator admin UI is opt-in; never enabled in production unless explicitly set. */
function adminUiEnabled(): boolean {
  return process.env.ADMIN_UI_ENABLED === "true";
}

/**
 * Operator allowlist. This proxy injects the privileged ADMIN_API_KEY, so it MUST
 * only ever act for an authenticated operator. Membership is by email, configured
 * via ADMIN_ALLOWED_EMAILS (comma-separated). Fail closed: if the allowlist is
 * empty, nobody is an admin — a missing config can never open the admin surface.
 */
function adminAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Reject path traversal so a crafted segment cannot escape the /v1/admin prefix. */
function isSafeSegments(segments: string[]): boolean {
  return segments.every(
    (s) => s !== ".." && s !== "." && !s.includes("/") && !s.includes("\\"),
  );
}

async function proxyAdmin(request: NextRequest, segments: string[]): Promise<NextResponse> {
  if (!adminUiEnabled()) {
    return NextResponse.json({ error: "Admin UI is disabled" }, { status: 404 });
  }

  // AuthN: the admin surface lives behind a logged-in session.
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fail closed: the operator email allowlist is MANDATORY. An empty/unset
  // ADMIN_ALLOWED_EMAILS means nobody is an admin, so a missing config can never
  // silently open the admin surface to any logged-in user who obtains the key.
  const allowlist = adminAllowlist();
  if (allowlist.size === 0 || !allowlist.has(email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return NextResponse.json({ error: "ADMIN_API_KEY not configured on web server" }, { status: 503 });
  }

  // MANDATORY: the operator must present the admin key. There is no path to any
  // admin function (whitelist/approve, freeze/block, audit, …) without it — the
  // UI, like a direct API caller, must supply the key. Verified constant-time
  // here; the server then forwards its own copy to the backend (which ALSO
  // requires x-admin-key), so the boundary holds even if this check regressed.
  if (!secretEquals(request.headers.get("x-admin-key"), adminKey)) {
    return NextResponse.json({ error: "Valid admin key required" }, { status: 401 });
  }

  if (!isSafeSegments(segments)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = `/v1/admin/${segments.join("/")}`;
  const search = request.nextUrl.search;
  const target = `${apiOrigin()}${path}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("x-admin-key", adminKey);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "API unavailable" }, { status: 503 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyAdmin(request, path);
}
