import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Helvex — the permissioned RFQ desk on Canton Network. KYC-approved users trade CC, CBTC, and USDCx with firm quotes and atomic settlement.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in to Helvex",
    description:
      "KYC-gated RFQ trading on Canton Network. CC, CBTC, and USDCx with atomic DvP settlement.",
    url: "/login",
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
