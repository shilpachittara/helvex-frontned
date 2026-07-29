"use client";

import { useEffect, useState } from "react";
import { formatDeadlineRelative, formatUtcDateTime } from "../lib/format-time";

/**
 * Relative deadline that stays hydration-safe: first paint matches SSR
 * (stable UTC), then switches to a relative label after mount.
 */
export function DeadlineLabel({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => formatUtcDateTime(iso));

  useEffect(() => {
    const tick = () => setLabel(formatDeadlineRelative(iso));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return <span title={formatUtcDateTime(iso)}>{label}</span>;
}
