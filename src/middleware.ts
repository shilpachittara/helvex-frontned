import { NextResponse } from "next/server";
import { auth } from "./auth";
import { EDGE_COUNTRY_HEADER, EDGE_IP_HEADER, normalizeCountryCode } from "./lib/proxy-guard";

/**
 * Public routes that must remain reachable without a session. Everything else
 * matched below requires an authenticated NextAuth session. This is the real
 * server-side gate — `AuthGuard` on the client is only a UX/loading affordance
 * and must not be relied upon for access control.
 */
const PUBLIC_PATHS = ["/login", "/kyc", "/setup-password", "/forgot-password", "/reset-password"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function withEdgeGeo(req: { headers: Headers; geo?: { country?: string } }): Headers {
  const requestHeaders = new Headers(req.headers);
  // Never trust a browser-supplied stamp — Edge overwrites from Vercel/CF.
  requestHeaders.delete(EDGE_COUNTRY_HEADER);
  requestHeaders.delete(EDGE_IP_HEADER);

  const country = normalizeCountryCode(
    req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.geo?.country,
  );
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();

  if (country) requestHeaders.set(EDGE_COUNTRY_HEADER, country);
  if (ip) requestHeaders.set(EDGE_IP_HEADER, ip);
  return requestHeaders;
}

export default auth((req) => {
  const requestHeaders = withEdgeGeo(req);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  const { pathname, search, origin } = req.nextUrl;
  if (pathname.startsWith("/api/")) return next();
  if (isPublic(pathname)) return next();

  if (!req.auth?.user) {
    const url = new URL("/login", origin);
    const returnTo = `${pathname}${search || ""}`;
    url.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(url);
  }
  return next();
});

export const config = {
  // Include /api so Edge can stamp Vercel geo for the Node proxy. Previously
  // `api` was excluded, so /api/v1/access/session never saw x-vercel-ip-country.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
