import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Helvex — a permissioned, trader-first RFQ desk on Canton Network. You set the minimum you'll receive. Solvers bid to meet or beat it.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in to Helvex",
    description:
      "KYC-gated trader-first RFQ on Canton Network. You set the minimum you'll receive. CC, CBTC, and USDCx settle atomically.",
    url: "/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
