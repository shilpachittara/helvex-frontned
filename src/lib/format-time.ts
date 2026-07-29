/** Stable, locale-independent timestamps (identical on server + client). */
export function formatUtcDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

/** Relative deadline label. Uses Date.now() — only call after mount. */
export function formatDeadlineRelative(iso: string, nowMs: number = Date.now()): string {
  const d = new Date(iso);
  const diff = d.getTime() - nowMs;
  if (!Number.isFinite(diff)) return "—";
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}
