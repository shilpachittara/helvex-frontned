"use client";

import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { WalletProvider } from "./WalletProvider";

export function WalletSessionBridge({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return (
    <WalletProvider accountEmail={session?.user?.email ?? null}>{children}</WalletProvider>
  );
}
