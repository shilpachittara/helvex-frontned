/**
 * Pure request-path guards for the browser → backend proxy. Extracted so they
 * can be unit-tested in isolation (see proxy-guard.test.ts).
 */

/**
 * Backend paths that must never be reachable from the browser. Auth login and
 * Google linking are server-to-server only; `/internal/*`, `/v1/admin/*` and
 * `/v1/dev/*` are operator/dev-only.
 */
export const BLOCKED_PROXY_PATHS = new Set(["/v1/auth/login", "/v1/auth/link-google"]);

export function isBlockedProxyPath(path: string): boolean {
  return (
    BLOCKED_PROXY_PATHS.has(path) ||
    path.startsWith("/internal/") ||
    path.startsWith("/v1/admin/") ||
    // Dev-only simulation/debug endpoints must never be browser-reachable, even
    // though the backend also disables them when NODE_ENV=production.
    path.startsWith("/v1/dev/")
  );
}

/**
 * Reject path traversal and smuggled separators. Without this, a crafted
 * segment like `..` (or a percent-encoded `%2f` that decodes to `/`) would let
 * the fetch URL normalize `/v1/x/../admin/y` into `/v1/admin/y` AFTER the block
 * check ran against the un-normalized string — bypassing `isBlockedProxyPath`
 * and reaching privileged/internal endpoints.
 */
export function hasTraversal(path: string): boolean {
  return path.split("/").some((rawSeg) => {
    let seg = rawSeg;
    try {
      seg = decodeURIComponent(rawSeg);
    } catch {
      return true; // malformed encoding — reject
    }
    return seg === ".." || seg === "." || seg.includes("/") || seg.includes("\\");
  });
}
