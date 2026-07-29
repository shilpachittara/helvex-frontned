const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  LOCK_PENDING: "Locking",
  LOCKED: "Locked",
  MATCHED: "Matched",
  SETTLING: "Settling",
  SETTLED: "Settled",
  EXPIRED: "Expired",
  REFUNDING: "Refunding",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "settled") return "status-settled";
  if (["locked", "matched", "settling"].includes(s)) return "status-locked";
  if (["submitted", "lock_pending", "draft"].includes(s)) return "status-submitted";
  // Refunded / refunding are intentional outcomes (yellow), not hard failures.
  if (["refunded", "refunding", "expired", "cancelled"].includes(s)) return "status-refunded";
  if (s === "failed") return "status-failed";
  return "status-submitted";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${statusClass(status)} status-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const STEPS = ["SUBMITTED", "LOCKED", "MATCHED", "SETTLING", "SETTLED"] as const;

function stepIndex(status: string): number {
  if (status === "SETTLED") return 5;
  if (status === "SETTLING") return 4;
  if (status === "MATCHED") return 3;
  if (status === "LOCKED" || status === "LOCK_PENDING") return 2;
  if (status === "SUBMITTED") return 1;
  if (["REFUNDED", "REFUNDING", "EXPIRED", "CANCELLED", "FAILED"].includes(status)) return -1;
  return 0;
}

export function IntentProgress({ status }: { status: string }) {
  const current = stepIndex(status);
  if (current < 0) return null;

  return (
    <div className="progress-steps" aria-hidden>
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={`progress-step${i < current ? " done" : ""}${i === current - 1 ? " active" : ""}`}
        />
      ))}
    </div>
  );
}
