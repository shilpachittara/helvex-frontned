import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DM_Sans, Syne } from "next/font/google";
import type { ReactNode } from "react";
import { AccessGate } from "../components/AccessGate";
import { AuthSessionProvider } from "../components/SessionProvider";
import { JsonLd } from "../components/JsonLd";
import { auth } from "../auth";
import { SITE, siteOrigin } from "../lib/site";

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

const origin = siteOrigin();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030508" },
    { media: "(prefers-color-scheme: light)", color: "#030508" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: `${SITE.brand} | CC, CBTC & USDCx`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.marketingUrl }],
  creator: SITE.name,
  publisher: SITE.parentOrg,
  keywords: [
    "Helvex",
    "Helvex Canton",
    "Canton Network",
    "RFQ",
    "private swaps",
    "atomic DvP",
    "CC",
    "Canton Coin",
    "CBTC",
    "USDCx",
    "Loop wallet",
    "KYC",
    "Dream Capital",
  ],
  category: "finance",
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-256.png", sizes: "256x256", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icon-256.png", sizes: "256x256" },
    ],
    shortcut: ["/favicon-32.png"],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: origin,
    siteName: SITE.brand,
    title: SITE.brand,
    description: SITE.shortDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Helvex — Private RFQ swaps on Canton Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE.twitter,
    creator: SITE.twitter,
    title: SITE.brand,
    description: SITE.shortDescription,
    images: ["/og-image.png"],
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <JsonLd />
        <AuthSessionProvider session={session}>
          <AccessGate>{children}</AccessGate>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
