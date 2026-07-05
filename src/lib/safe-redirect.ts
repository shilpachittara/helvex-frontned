/**
 * Only allow same-origin, path-relative redirects after login. An attacker-
 * supplied `?callbackUrl=https://evil.example` (or `//evil.example`) would
 * otherwise turn the login page into an open redirect for phishing.
 *
 * `origin` defaults to `window.location.origin` in the browser; it is a
 * parameter so the logic can be unit-tested without a DOM.
 */
export function safeCallback(
  raw: string | null,
  origin: string = typeof window !== "undefined" ? window.location.origin : "http://localhost",
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return "/";
    return u.pathname + u.search;
  } catch {
    return "/";
  }
}
