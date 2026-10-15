"use client";

import { useCallback, useEffect, useState } from "react";
import type { LoopHoldingView } from "./loop-holdings";
import { useWallet } from "./wallet/WalletProvider";

/** Live unlocked holdings for the connected Loop wallet. */
export function useLoopHoldings(enabled: boolean) {
  const { status, readLoopHoldings } = useWallet();
  const [holdings, setHoldings] = useState<LoopHoldingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<LoopHoldingView[]> => {
    const rows = await readLoopHoldings();
    setHoldings(rows);
    setError(null);
    return rows;
  }, [readLoopHoldings]);

  useEffect(() => {
    if (!enabled || status !== "connected") {
      setHoldings(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    readLoopHoldings()
      .then((rows) => {
        if (cancelled) return;
        setHoldings(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setHoldings(null);
        setError(err instanceof Error ? err.message : "Couldn't read Loop balance");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, status, readLoopHoldings]);

  return { holdings, error, loading, refresh };
}
