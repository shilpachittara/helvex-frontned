import { NextResponse } from "next/server";
import { auth } from "./auth";

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

export default auth((req) => {
  const { pathname, search, origin } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (!req.auth?.user) {
    const url = new URL("/login", origin);
    // Keep query string (e.g. /reset-password?email=&token=) so a mistaken
    // redirect doesn't wipe the one-time code from the email link.
    const returnTo = `${pathname}${search || ""}`;
    url.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Protect all app routes except Next internals, the API proxy (which enforces
  // its own auth), static assets, and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
