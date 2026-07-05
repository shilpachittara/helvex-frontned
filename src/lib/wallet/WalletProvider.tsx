"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CanonicalIntentPayload } from "@intent-swap/domain";
import { linkLoopWallet, fetchWalletProfile } from "../api";
import {
  autoConnectLoopWallet,
  connectLoopWallet,
  disconnectLoopWallet,
  emailFromProvider,
  initLoopWallet,
  partyFromProvider,
  transferWithLoop,
} from "./loop-client";
import { isLoopWalletEnabled, loopNetworkFromEnv } from "./config";
import { signIntentPayload } from "./sign-intent";
import type {
  ConnectedWallet,
  LoopProvider,
  WalletContextValue,
  WalletKind,
  WalletStatus,
  WalletTransferInput,
} from "./types";

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({
  children,
  accountEmail,
}: {
  children: ReactNode;
  accountEmail?: string | null;
}) {
  const loopEnabled = isLoopWalletEnabled();
  const kind: WalletKind = loopEnabled ? "loop" : "dev";
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const providerRef = useRef<LoopProvider | null>(null);

  const linkAccountWallet = useCallback(
    async (provider: LoopProvider) => {
      if (!accountEmail) return;
      const loopEmail = emailFromProvider(provider)?.trim().toLowerCase();
      const partyId = partyFromProvider(provider);
      if (!loopEmail) {
        setLinkMessage("Loop connected, but no email returned — link your Loop account email to your login.");
        return;
      }
      if (loopEmail !== accountEmail.trim().toLowerCase()) {
        setError(
          `Loop wallet (${loopEmail}) does not match your login (${accountEmail}). Sign in with the same email as your Loop account.`,
        );
        return;
      }
      try {
        await linkLoopWallet({
          email: accountEmail,
          cantonPartyId: partyId,
          loopEmail,
        });
        setLinkMessage(`Loop wallet linked · ${partyId}`);
        setError(null);
      } catch (err) {
        setLinkMessage(null);
        setError(err instanceof Error ? err.message : "Failed to link Loop wallet");
      }
    },
    [accountEmail],
  );

  const handleAccept = useCallback(
    (provider: LoopProvider) => {
      providerRef.current = provider;
      setWallet({
        kind: "loop",
        partyId: partyFromProvider(provider),
        email: emailFromProvider(provider),
      });
      setStatus("connected");
      setError(null);
      void linkAccountWallet(provider);
    },
    [linkAccountWallet],
  );

  const handleReject = useCallback(() => {
    providerRef.current = null;
    setWallet(null);
    setStatus("disconnected");
    setError("Loop connection was rejected.");
  }, []);

  useEffect(() => {
    if (kind !== "loop") return;
    initLoopWallet({
      network: loopNetworkFromEnv(),
      onAccept: handleAccept,
      onReject: handleReject,
    });
    void autoConnectLoopWallet().catch(() => {
      /* no saved Loop session */
    });
  }, [kind, handleAccept, handleReject]);

  useEffect(() => {
    if (!accountEmail || kind !== "loop" || status === "connected") return;
    void fetchWalletProfile(accountEmail)
      .then((profile) => {
        if (profile.cantonPartyId) {
          setLinkMessage(`Registered party · ${profile.cantonPartyId} — connect Loop to sign intents`);
        }
      })
      .catch(() => {});
  }, [accountEmail, kind, status]);

  const connect = useCallback(async () => {
    if (kind !== "loop") {
      setWallet({ kind: "dev", partyId: "", email: undefined });
      setStatus("connected");
      return;
    }

    setError(null);
    setLinkMessage(null);
    setStatus("connecting");
    try {
      await connectLoopWallet();
    } catch (err) {
      setStatus("disconnected");
      setError(err instanceof Error ? err.message : "Failed to connect Loop wallet");
    }
  }, [kind]);

  const disconnect = useCallback(() => {
    if (kind === "loop") {
      disconnectLoopWallet();
      providerRef.current = null;
    }
    setWallet(null);
    setStatus("disconnected");
    setError(null);
    setLinkMessage(null);
  }, [kind]);

  const signIntent = useCallback(
    async (payload: CanonicalIntentPayload) => {
      if (kind === "loop" && !providerRef.current) {
        throw new Error("Connect your Loop wallet before submitting an intent.");
      }
      return signIntentPayload(wallet, providerRef.current, payload);
    },
    [kind, wallet],
  );

  const transfer = useCallback(
    async (input: WalletTransferInput) => {
      if (kind !== "loop" || !providerRef.current) {
        throw new Error("Connect your Loop wallet before depositing.");
      }
      // "CC" is the native amulet; the SDK defaults to it when no instrument is
      // given. Other tokens are passed by their registry instrument id.
      const instrument =
        input.instrumentId && input.instrumentId !== "CC"
          ? { instrument_id: input.instrumentId }
          : undefined;
      await transferWithLoop(providerRef.current, {
        receiver: input.to,
        amount: input.amount,
        instrument,
      });
    },
    [kind],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      kind,
      status,
      wallet,
      error,
      linkMessage,
      connect,
      disconnect,
      signIntent,
      transfer,
    }),
    [kind, status, wallet, error, linkMessage, connect, disconnect, signIntent, transfer],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
