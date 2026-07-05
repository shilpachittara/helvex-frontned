/** Server-side calls to the Hono API for auth (avoids PGlite in Next.js webpack). */

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string | null;
  cantonPartyId: string | null;
  kycStatus: string;
}

function authApiBase(): string {
  // Server-only calls: prefer an internal (non-browser-exposed) URL so login
  // and Google-linking traffic never leaves the internal network in split
  // deployments. Fall back to the public URL only if no internal one is set.
  const configured =
    process.env.INTERNAL_API_URL ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  const port = process.env.API_PORT ?? process.env.NEXT_PUBLIC_API_PORT ?? "8080";
  return `http://127.0.0.1:${port}`;
}

function internalAuthHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_PROXY_SECRET ?? process.env.SESSION_SECRET;
  return secret ? { "x-internal-auth": secret } : {};
}

export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<AuthUserPayload | null> {
  const res = await fetch(`${authApiBase()}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as AuthUserPayload;
}

export async function linkGoogleAccount(input: {
  email: string;
  googleId: string;
  displayName: string | null;
}): Promise<AuthUserPayload | null> {
  const res = await fetch(`${authApiBase()}/v1/auth/link-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...internalAuthHeaders() },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as AuthUserPayload;
}
