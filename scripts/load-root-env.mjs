import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Frontend is a standalone project; its env file lives at frontend/.env.
export const REPO_ROOT = join(__dirname, "..");

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eq = trimmed.indexOf("=");
  if (eq === -1) return null;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  const hash = val.indexOf(" #");
  if (hash !== -1) val = val.slice(0, hash).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return [key, val];
}

/** Parse repo root `.env` into a plain object (no process.env mutation). */
export function readRootEnvFile() {
  const envPath = join(REPO_ROOT, ".env");
  const values = {};
  if (!existsSync(envPath)) return values;

  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const parsed = parseEnvLine(line);
    if (parsed) values[parsed[0]] = parsed[1];
  }
  return values;
}

export function parsePort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Fill derived NEXT_PUBLIC_* and related defaults from core vars. */
export function applyDerivedEnv(env) {
  const apiPort = parsePort(env.API_PORT, 8080);
  const webPort = parsePort(env.WEB_PORT, 3001);

  if (!env.API_URL) {
    env.API_URL = `http://localhost:${apiPort}`;
  }
  if (!env.WEB_URL) {
    env.WEB_URL = `http://localhost:${webPort}`;
  }
  if (!env.NEXT_PUBLIC_API_URL) {
    env.NEXT_PUBLIC_API_URL = env.API_URL;
  }
  if (!env.NEXT_PUBLIC_API_PORT) {
    env.NEXT_PUBLIC_API_PORT = String(apiPort);
  }
  // SECURITY: never derive a NEXT_PUBLIC_SOLVER_API_KEY. The solver key is a
  // privileged credential; exposing it in the client bundle would let any
  // browser fill intents as an arbitrary solver. Solver calls are authenticated
  // server-side (session solver scope or API key), never with a bundled key.
  if (!env.NEXT_PUBLIC_CANTON_NETWORK && env.CANTON_NETWORK) {
    env.NEXT_PUBLIC_CANTON_NETWORK = env.CANTON_NETWORK;
  }
  if (!env.NEXT_PUBLIC_WALLET_PROVIDER) {
    env.NEXT_PUBLIC_WALLET_PROVIDER = "dev";
  }
  if (!env.NEXT_PUBLIC_LOOP_NETWORK) {
    env.NEXT_PUBLIC_LOOP_NETWORK = "devnet";
  }
  const googleId = env.GOOGLE_CLIENT_ID ?? "";
  const googleSecret = env.GOOGLE_CLIENT_SECRET ?? "";
  if (!env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED) {
    env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED =
      googleId && googleSecret ? "true" : "false";
  }
  // SECURITY: never fall back to a predictable AUTH_SECRET in production. A
  // known secret lets an attacker forge NextAuth session JWTs (account
  // takeover). In production, leave it unset so NextAuth fails fast and the
  // operator is forced to configure a strong random value.
  if (!env.AUTH_SECRET && process.env.NODE_ENV !== "production") {
    env.AUTH_SECRET = "dev-auth-secret-change-in-production";
  }
  if (!env.INTENT_SIGNATURE_MODE) {
    env.INTENT_SIGNATURE_MODE = "hybrid";
  }
  return env;
}

/** Root `.env` with derived defaults applied. */
export function getResolvedEnv() {
  return applyDerivedEnv({ ...readRootEnvFile() });
}

const FRONTEND_MIN_SECRET_LEN = 24;
const FRONTEND_KNOWN_PLACEHOLDERS = new Set([
  "dev-internal-proxy-secret-change-me",
  "dev-auth-secret-change-me-in-production",
  "dev-auth-secret-change-in-production",
  "change-me",
  "changeme",
  "secret",
  "password",
]);

function isWeakFrontendSecret(v) {
  if (!v) return true;
  const s = String(v).trim();
  return s.length < FRONTEND_MIN_SECRET_LEN || FRONTEND_KNOWN_PLACEHOLDERS.has(s.toLowerCase());
}

/**
 * Fail-closed boot check for production runtime (frontend audit #4, #5 + X-4).
 * Runs only at server start (`next start`), NOT during `next build` — build
 * environments legitimately lack runtime secrets. Throws with an actionable list.
 */
export function assertFrontendProductionConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return;
  // Skip the compile phase; only enforce when actually serving.
  // `next.config.mjs` is evaluated during `next build` before NEXT_PHASE is
  // always set (Vercel/CI), so also detect build via argv / lifecycle.
  const isNextBuild =
    env.NEXT_PHASE === "phase-production-build" ||
    env.npm_lifecycle_event === "build" ||
    process.argv.includes("build");
  if (isNextBuild) return;

  const errors = [];
  // #4 — secrets must be strong and not the shipped placeholders.
  if (isWeakFrontendSecret(env.AUTH_SECRET)) {
    errors.push(
      "AUTH_SECRET is missing, too short (<24 chars), or a known placeholder. A guessable value lets an attacker forge NextAuth session JWTs (account takeover).",
    );
  }
  const proxySecret = env.INTERNAL_PROXY_SECRET || env.SESSION_SECRET;
  if (isWeakFrontendSecret(proxySecret)) {
    errors.push(
      "INTERNAL_PROXY_SECRET (or SESSION_SECRET) is missing, too short, or a known placeholder. It signs the proxy identity/geo the backend trusts; a weak value lets anyone impersonate users and forge their region.",
    );
  }
  // #5 — pin the canonical URL so callback/redirect derivation never trusts the
  // inbound Host header (host-header injection → poisoned OAuth callback/links).
  if (!(env.AUTH_URL || env.NEXTAUTH_URL)) {
    errors.push(
      "AUTH_URL (or NEXTAUTH_URL) must be set in production so NextAuth derives callback/redirect URLs from a pinned origin, not the attacker-influenceable Host header.",
    );
  }
  // X-4 — never ship the forgeable dev signer on mainnet.
  if ((env.NEXT_PUBLIC_CANTON_NETWORK ?? "").toLowerCase() === "mainnet") {
    if ((env.NEXT_PUBLIC_WALLET_PROVIDER ?? "dev").toLowerCase() !== "loop") {
      errors.push(
        "NEXT_PUBLIC_WALLET_PROVIDER must be 'loop' on mainnet. The 'dev' signer produces a forgeable dev:<sha256> value with no cryptographic authorization.",
      );
    }
    if ((env.INTENT_SIGNATURE_MODE ?? "").toLowerCase() === "dev") {
      errors.push("INTENT_SIGNATURE_MODE must not be 'dev' on mainnet (use 'loop').");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      "Refusing to start the frontend in production due to insecure configuration:\n" +
        errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n") +
        "\n\nFix these in the environment (see frontend/.env.example), then restart.",
    );
  }
}

/** Load root `.env` (+ derived defaults) into process.env. */
export function applyRootEnv(options = {}) {
  const { override = false } = options;
  const values = getResolvedEnv();
  for (const [key, val] of Object.entries(values)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  assertFrontendProductionConfig(process.env);
  return values;
}

export function apiPublicUrl(env = getResolvedEnv()) {
  return env.API_URL ?? env.NEXT_PUBLIC_API_URL ?? `http://localhost:${parsePort(env.API_PORT, 8080)}`;
}

export function webPublicUrl(env = getResolvedEnv()) {
  return env.WEB_URL ?? `http://localhost:${parsePort(env.WEB_PORT, 3001)}`;
}

/**
 * Keys injected into the Next.js client bundle via next.config `env`.
 * SECURITY: only ever list values that are safe to ship to the browser. Never
 * add secrets here (AUTH_SECRET, *_CLIENT_SECRET, ADMIN_API_KEY, proxy secrets);
 * next.config `env` inlines these into client JS. Server code reads secrets from
 * process.env (loaded by applyRootEnv + Next's native .env loading) instead.
 */
export function nextPublicEnvKeys(env = getResolvedEnv()) {
  return {
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_PORT: env.NEXT_PUBLIC_API_PORT,
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? "false",
    NEXT_PUBLIC_WALLET_PROVIDER: env.NEXT_PUBLIC_WALLET_PROVIDER ?? "dev",
    NEXT_PUBLIC_LOOP_NETWORK: env.NEXT_PUBLIC_LOOP_NETWORK ?? "devnet",
    NEXT_PUBLIC_CANTON_NETWORK: env.NEXT_PUBLIC_CANTON_NETWORK ?? "devnet",
  };
}
