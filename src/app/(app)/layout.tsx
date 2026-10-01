import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthGuard } from "../../components/AuthGuard";
import { AppShell } from "../../components/AppShell";
import { WalletSessionBridge } from "../../lib/wallet/WalletSessionBridge";

/** Authenticated desk — keep out of search indexes. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <WalletSessionBridge>
        <AppShell>{children}</AppShell>
      </WalletSessionBridge>
    </AuthGuard>
  );
}
