import "./globals.css";
import { DM_Sans, Syne } from "next/font/google";
import type { ReactNode } from "react";
import { AccessGate } from "../components/AccessGate";
import { AuthSessionProvider } from "../components/SessionProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Intent Swap · Canton Network",
  description: "Permissioned intent-based swap — sign what you want, not how to get it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body>
        <AuthSessionProvider>
          <AccessGate>{children}</AccessGate>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
