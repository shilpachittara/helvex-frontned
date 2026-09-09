import {
  abandonDeposit,
  acceptPendingDeposits,
  fetchBalances,
  prepareDeposit,
  type Instrument,
} from "./api";
import { normalizeAmount } from "./amount";
import type { BalanceView } from "./api";

function availableForSymbol(balances: BalanceView[], symbol: string): string | null {
  const match = balances.find(
    (b) =>
      b.symbol === symbol ||
      b.instrument === symbol ||
      (symbol === "CC" && b.instrument === "Amulet"),
  );
  return match ? match.available : null;
}

export type FundingSource = "helvex" | "loop";

export type FundFromLoopProgress = "preparing" | "awaiting_loop" | "crediting";

export type LoopTransferFn = (input: {
  to: string;
  amount: string;
  instrumentId?: string;
  loopInstrument?: { instrument_id: string; instrument_admin?: string };
}) => Promise<void>;

const DEFAULT_TIMEOUT_MS = 90_000;
const POLL_MS = 3_000;

export function toDepositInstrument(symbol: string): Instrument {
  const u = String(symbol ?? "")
    .trim()
    .toUpperCase();
  if (u === "CC" || u === "AMULET") return "CC";
  if (u === "CBTC") return "CBTC";
  if (u === "USDCX" || u === "USDC") return "USDCX";
  throw new Error(`Unsupported token ${symbol}`);
}

export function availableCovers(available: string | null | undefined, need: string): boolean {
  if (available == null || available === "") return false;
  const a = Number.parseFloat(available);
  const n = Number.parseFloat(need);
  return Number.isFinite(a) && Number.isFinite(n) && n > 0 && a + 1e-12 >= n;
}

function newIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Move `amount` of `symbol` from the connected Loop wallet onto the Helvex
 * trading ID, then wait until that amount is `available` for lock/fill.
 */
export async function fundFromLoop(opts: {
  appParty: string;
  symbol: string;
  amount: string;
  transfer: LoopTransferFn;
  onProgress?: (stage: FundFromLoopProgress) => void;
  timeoutMs?: number;
}): Promise<void> {
  const amount = normalizeAmount(opts.amount);
  const instrument = toDepositInstrument(opts.symbol);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  opts.onProgress?.("preparing");
  const prepared = await prepareDeposit(opts.appParty, {
    instrument,
    amount,
    idempotencyKey: newIdempotencyKey(),
  });

  opts.onProgress?.("awaiting_loop");
  try {
    await opts.transfer({
      to: prepared.depositTo,
      amount,
      instrumentId: instrument,
      loopInstrument: prepared.loopInstrument,
    });
  } catch (err) {
    await abandonDeposit(opts.appParty, prepared.deposit.id).catch(() => undefined);
    const msg = err instanceof Error ? err.message : "Loop transfer failed";
    throw new Error(
      `Loop approval failed: ${msg}. Open Loop, confirm the transfer, and try again.`,
    );
  }

  opts.onProgress?.("crediting");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await acceptPendingDeposits(opts.appParty).catch(() => undefined);
    const { balances } = await fetchBalances(opts.appParty);
    if (availableCovers(availableForSymbol(balances, opts.symbol), amount)) {
      return;
    }
    await sleep(POLL_MS);
  }

  throw new Error(
    `Loop sent ${amount} ${instrument}, but Helvex has not credited it yet. Wait a moment, refresh balances, then submit again.`,
  );
}
