"use client";

import { loop } from "@fivenorth/loop-sdk";
import type { LoopInstrumentSpec, LoopNetwork, LoopProvider } from "./types";

const LOOP_CONNECT_STORAGE_KEY = "loop_connect";

let initialized = false;
let initializedNetwork: LoopNetwork | null = null;

/** Drop a stale Connect ticket so the next `loop.connect()` can mint a fresh one. */
export function clearLoopConnectSession(): void {
  try {
    localStorage.removeItem(LOOP_CONNECT_STORAGE_KEY);
    sessionStorage.removeItem(LOOP_CONNECT_STORAGE_KEY);
  } catch {
    /* ignore storage access errors */
  }
}

/** True when localStorage has a Loop session the SDK can actually resume. */
function hasPersistedLoopSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(LOOP_CONNECT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(
      parsed.ticketId &&
        parsed.sessionId &&
        parsed.authToken &&
        parsed.partyId &&
        parsed.publicKey,
    );
  } catch {
    clearLoopConnectSession();
    return false;
  }
}

type LoopInitOptions = {
  network: LoopNetwork;
  onAccept: (provider: LoopProvider) => void;
  onReject: () => void;
};

let lastInit: LoopInitOptions | null = null;

function applyLoopInit(options: LoopInitOptions): void {
  loop.init({
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Helvex",
    network: options.network,
    options: {
      openMode: "popup",
      requestSigningMode: "popup",
    },
    onAccept: (provider) => options.onAccept(provider as LoopProvider),
    onReject: options.onReject,
    onTransactionUpdate: () => {},
  });
  initialized = true;
  initializedNetwork = options.network;
  lastInit = options;
}

export function initLoopWallet(options: LoopInitOptions): void {
  if (typeof window === "undefined") return;
  lastInit = options;
  // Re-init when network changes (e.g. local → testnet) so we don't reuse the
  // wrong wallet host / cached ticket.
  if (initialized && initializedNetwork !== options.network) {
    try {
      loop.logout();
    } catch {
      /* ignore */
    }
    clearLoopConnectSession();
  }

  // Do not call init() again on the same network: it replaces the Connection
  // and any in-flight ticket, so the Loop popup opens without ticketId
  // ("Invalid Connection Request / No ticket ID provided").
  if (initialized && initializedNetwork === options.network) return;
  applyLoopInit(options);
}

let autoConnectInFlight: Promise<void> | null = null;

export async function autoConnectLoopWallet(): Promise<void> {
  if (typeof window === "undefined") return;
  if (typeof loop.autoConnect !== "function") return;
  // No saved handshake — skip. The SDK still constructs a blank session and
  // can throw "No valid session found" / fail verifySession (Next overlay).
  if (!hasPersistedLoopSession()) return;
  if (autoConnectInFlight) return autoConnectInFlight;

  autoConnectInFlight = (async () => {
    try {
      await loop.autoConnect();
    } catch {
      // Stale/expired ticket or Loop API unreachable — clear and let the user
      // click Connect for a fresh handshake.
      clearLoopConnectSession();
      try {
        loop.logout();
      } catch {
        /* ignore */
      }
    } finally {
      autoConnectInFlight = null;
    }
  })();
  return autoConnectInFlight;
}

export async function connectLoopWallet(): Promise<void> {
  if (autoConnectInFlight) {
    await autoConnectInFlight.catch(() => undefined);
  }
  if (!initialized && lastInit) applyLoopInit(lastInit);

  try {
    await loop.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not initialized/i.test(msg) && lastInit) {
      initialized = false;
      applyLoopInit(lastInit);
      await loop.connect();
      return;
    }
    // Ticket expired / invalid connection details — wipe cache and retry once.
    if (/ticket|expired|invalid|connection details/i.test(msg)) {
      clearLoopConnectSession();
      try {
        loop.logout();
      } catch {
        /* ignore */
      }
      await loop.connect();
      return;
    }
    throw err;
  }
}

export function disconnectLoopWallet(): void {
  try {
    loop.logout();
  } finally {
    clearLoopConnectSession();
  }
}

export async function signWithLoop(provider: LoopProvider, message: string): Promise<string> {
  const result = await provider.signMessage(message);
  const encoded = typeof result === "string" ? result : JSON.stringify(result);
  return `loop:${encoded}`;
}

export function partyFromProvider(provider: LoopProvider): string {
  return provider.party_id;
}

export function emailFromProvider(provider: LoopProvider): string | undefined {
  return provider.email;
}

/** Transfer tokens from the connected Loop wallet to another party (deposit). */
export async function transferWithLoop(
  provider: LoopProvider,
  args: { receiver: string; amount: string; instrument?: LoopInstrumentSpec },
): Promise<unknown> {
  if (typeof provider.transfer !== "function") {
    throw new Error("This Loop wallet build does not support transfers.");
  }
  return provider.transfer(args.receiver, args.amount, args.instrument);
}
