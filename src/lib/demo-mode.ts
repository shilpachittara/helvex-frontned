/**
 * Demo presentation mode — masks PII / party IDs and brands as MainNet for recordings.
 * Enable with NEXT_PUBLIC_DEMO_MODE=true (restart Next.js after changing).
 */
export function isDemoMode(): boolean {
  return (process.env.NEXT_PUBLIC_DEMO_MODE ?? "").trim().toLowerCase() === "true";
}

export function networkBadgeLabel(fallbackNetwork: string): string {
  if (isDemoMode()) return "Canton MainNet";
  if (fallbackNetwork === "localnet") return "Canton LocalNet";
  if (fallbackNetwork === "testnet") return "Canton TestNet";
  if (fallbackNetwork === "mainnet") return "Canton MainNet";
  return "Canton DevNet";
}

/** Mask an email for on-screen display in demos. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Verified user";
  const [user, domain] = email.split("@");
  if (!domain) return "Verified user";
  const u = user.length <= 2 ? `${user[0] ?? "*"}*` : `${user.slice(0, 2)}***`;
  const d = domain.includes(".") ? `***.${domain.split(".").pop()}` : "***";
  return `${u}@${d}`;
}
