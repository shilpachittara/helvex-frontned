import "./globals.css";
import { DM_Sans, Syne } from "next/font/google";
import type { ReactNode } from "react";
import { AccessGate } from "../components/AccessGate";
import { AuthSessionProvider } from "../components/SessionProvider";
import { auth } from "../auth";

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
  title: "Helvex · Canton Network",
  description: "Helvex — permissioned intent-based swap on Canton Network.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/helvex-logo.png" }],
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthSessionProvider session={session}>
          <AccessGate>{children}</AccessGate>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
