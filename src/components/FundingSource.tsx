"use client";

import { useCallback, useEffect, useState } from "react";
import type { FundingSource } from "../lib/fund-from-loop";
import { isLoopWalletEnabled } from "../lib/wallet/config";

const STORAGE_KEY = "helvex.payFrom";

export function readFundingSource(): FundingSource {
  if (typeof window === "undefined") return "helvex";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "loop" ? "loop" : "helvex";
  } catch {
    return "helvex";
  }
}

function writeFundingSource(value: FundingSource) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function useFundingSource(): [FundingSource, (value: FundingSource) => void] {
  const [source, setSource] = useState<FundingSource>("helvex");

  useEffect(() => {
    if (!isLoopWalletEnabled()) {
      setSource("helvex");
      return;
    }
    setSource(readFundingSource());
  }, []);

  const update = useCallback((value: FundingSource) => {
    setSource(value);
    writeFundingSource(value);
  }, []);

  return [source, update];
}

function shortParty(party: string) {
  if (party.length <= 20) return party;
  return `${party.slice(0, 12)}…${party.slice(-4)}`;
}

export function FundingSourcePicker({
  value,
  onChange,
  purpose,
  loopConnected,
  loopParty,
  connecting,
  onConnect,
}: {
  value: FundingSource;
  onChange: (value: FundingSource) => void;
  purpose: "create" | "fill";
  loopConnected: boolean;
  loopParty?: string | null;
  connecting: boolean;
  onConnect: () => void;
}) {
  if (!isLoopWalletEnabled()) return null;

  const helvexCopy =
    purpose === "fill"
      ? "On your trading ID. Instant. No wallet popup."
      : "On your trading ID. Instant. No wallet popup.";
  const loopCopy =
    purpose === "fill"
      ? "Approve in Loop. We move the fill amount to Helvex, then accept."
      : "Approve in Loop. We move the amount to Helvex, then lock the RFQ.";

  return (
    <div className="funding-source">
      <p className="funding-source-label" id="pay-from-label">
        Pay from
      </p>
      <div className="funding-source-toggle" role="radiogroup" aria-labelledby="pay-from-label">
        <button
          type="button"
          role="radio"
          aria-checked={value === "helvex"}
          className={`funding-source-option${value === "helvex" ? " active" : ""}`}
          onClick={() => onChange("helvex")}
        >
          <span className="funding-source-title">Helvex balance</span>
          <span className="funding-source-desc">{helvexCopy}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === "loop"}
          className={`funding-source-option${value === "loop" ? " active" : ""}`}
          onClick={() => onChange("loop")}
        >
          <span className="funding-source-title">Loop wallet</span>
          <span className="funding-source-desc">{loopCopy}</span>
        </button>
      </div>

      {value === "loop" && !loopConnected && (
        <div className="funding-source-loop">
          <p className="field-hint">Connect Loop with the same email as this login.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Connect Loop"}
          </button>
        </div>
      )}

      {value === "loop" && loopConnected && (
        <div className="funding-source-loop">
          <ol className="funding-source-steps">
            <li>Approve the transfer in Loop</li>
            <li>{purpose === "fill" ? "Helvex accepts the fill" : "Helvex locks the RFQ"}</li>
          </ol>
          {loopParty ? (
            <p className="field-hint" title={loopParty}>
              Connected {shortParty(loopParty)}
            </p>
          ) : (
            <p className="field-hint">Loop connected</p>
          )}
        </div>
      )}
    </div>
  );
}
