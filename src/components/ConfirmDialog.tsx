"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({
  open,
  titleId,
  title,
  children,
  confirmLabel,
  dismissLabel = "Cancel",
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  titleId: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  dismissLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fund-confirm-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="fund-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        {children}
        <div className="fund-confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {dismissLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
