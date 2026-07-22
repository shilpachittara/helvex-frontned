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

export function initLoopWallet(options: {
  network: LoopNetwork;
  onAccept: (provider: LoopProvider) => void;
  onReject: () => void;
}): void {
  // Re-init when network changes (e.g. local → testnet) so we don't reuse the
  // wrong wallet host / cached ticket.
  if (initialized && initializedNetwork === options.network) return;
  if (initialized && initializedNetwork !== options.network) {
    try {
      loop.logout();
    } catch {
      /* ignore */
    }
    clearLoopConnectSession();
  }

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
}

export async function autoConnectLoopWallet(): Promise<void> {
  try {
    await loop.autoConnect();
  } catch {
    // Stale/expired ticket from a previous session — clear and let the user
    // click Connect for a fresh handshake (SDK 0.13+ also clears, belt+suspenders).
    clearLoopConnectSession();
    try {
      loop.logout();
    } catch {
      /* ignore */
    }
  }
}

export async function connectLoopWallet(): Promise<void> {
  try {
    await loop.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
