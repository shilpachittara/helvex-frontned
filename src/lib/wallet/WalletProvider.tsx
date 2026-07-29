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
  clearLoopConnectSession,
  connectLoopWallet,
  disconnectLoopWallet,
  emailFromProvider,
  initLoopWallet,
  partyFromProvider,
  transferWithLoop,
} from "./loop-client";
import { isDemoMode } from "../demo-mode";
import { intentSignatureMode, isLoopWalletEnabled, loopNetworkFromEnv } from "./config";
import { signIntentPayload } from "./sign-intent";
import type {
  ConnectedWallet,
  LoopInstrumentSpec,
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
      const loginEmail = accountEmail.trim().toLowerCase();
      // Demo recordings often use a Helvex login that differs from the Loop
      // account email — still link the party so deposit/withdraw work on camera.
      if (!isDemoMode()) {
        if (!loopEmail) {
          setLinkMessage(
            "Loop connected, but no email returned — link your Loop account email to your login.",
          );
          return;
        }
        if (loopEmail !== loginEmail) {
          setError(
            `Loop wallet (${loopEmail}) does not match your login (${accountEmail}). Sign in with the same email as your Loop account.`,
          );
          return;
        }
      }
      try {
        await linkLoopWallet({
          email: accountEmail,
          cantonPartyId: partyId,
          loopEmail: loopEmail || loginEmail,
        });
        setLinkMessage(
          isDemoMode()
            ? "Loop wallet connected"
            : `Loop wallet linked · ${partyId}`,
        );
        setError(null);
      } catch (err) {
        setLinkMessage(null);
        setError(
          isDemoMode()
            ? "Could not link wallet. Try Connect Wallet again."
            : err instanceof Error
              ? err.message
              : "Failed to link Loop wallet",
        );
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
        if (profile.loopPartyId || profile.cantonPartyId) {
          setLinkMessage("Wallet party on file — Connect Wallet to sign.");
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
    // Drop a stale Connect ticket before opening the popup — leftover
    // sessionStorage entries are the #1 cause of "not connecting" in demos.
    clearLoopConnectSession();
    providerRef.current = null;
    try {
      await connectLoopWallet();
    } catch (err) {
      setStatus("disconnected");
      const msg = err instanceof Error ? err.message : "Failed to connect Loop wallet";
      if (isDemoMode()) {
        setError("Allow the wallet popup, then click Connect Wallet again.");
      } else {
        setError(
          /ticket|expired|invalid|connection details/i.test(msg)
            ? `${msg} Cleared stale session — click Connect Wallet again (allow popups for localhost:3001).`
            : msg,
        );
      }
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
      // Dev intent signatures do not need Loop connected (validator-hosted app party).
      if (intentSignatureMode() !== "dev" && kind === "loop" && !providerRef.current) {
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
      // Prefer prepareDeposit's ledger selector (USDCx + admin). Fallback maps
      // UI symbols so we never send "USDCX" (wrong case) to Loop.
      let instrument: LoopInstrumentSpec | undefined = input.loopInstrument;
      if (!instrument) {
        const sym = (input.instrumentId ?? "CC").toUpperCase();
        if (sym === "CC") instrument = { instrument_id: "Amulet" };
        else if (sym === "USDCX") instrument = { instrument_id: "USDCx" };
        else instrument = { instrument_id: sym };
      }
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
