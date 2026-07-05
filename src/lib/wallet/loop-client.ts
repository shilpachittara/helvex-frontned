"use client";

import { loop } from "@fivenorth/loop-sdk";
import type { LoopInstrumentSpec, LoopNetwork, LoopProvider } from "./types";

let initialized = false;

export function initLoopWallet(options: {
  network: LoopNetwork;
  onAccept: (provider: LoopProvider) => void;
  onReject: () => void;
}): void {
  if (initialized) return;
  loop.init({
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Intent Swap",
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
}

export async function autoConnectLoopWallet(): Promise<void> {
  await loop.autoConnect();
}

export async function connectLoopWallet(): Promise<void> {
  await loop.connect();
}

export function disconnectLoopWallet(): void {
  loop.logout();
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
