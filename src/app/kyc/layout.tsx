import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Request KYC access",
  description:
    "Request KYC access to Helvex on Canton Network. Complete verification (government ID + live selfie) to activate your trading ID and swap CC, CBTC, and USDCx.",
  alternates: { canonical: "/kyc" },
  openGraph: {
    title: "Request Helvex KYC access",
    description:
      "Verify once, then trade on Helvex — permissioned RFQ desk for CC, CBTC, and USDCx on Canton MainNet.",
    url: "/kyc",
  },
};

export default function KycLayout({ children }: { children: ReactNode }) {
  return children;
}
