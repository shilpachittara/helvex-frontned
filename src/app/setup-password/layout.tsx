import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Set up password",
  robots: { index: false, follow: false },
};

export default function SetupPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
