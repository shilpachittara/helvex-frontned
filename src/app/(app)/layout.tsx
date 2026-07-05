import type { ReactNode } from "react";
import { AuthGuard } from "../../components/AuthGuard";
import { AppShell } from "../../components/AppShell";
import { WalletSessionBridge } from "../../lib/wallet/WalletSessionBridge";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <WalletSessionBridge>
        <AppShell>{children}</AppShell>
      </WalletSessionBridge>
    </AuthGuard>
  );
}
