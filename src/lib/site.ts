/**
 * Canonical public origin for the Helvex trading app (SEO / OG / sitemap).
 * Prefer NEXT_PUBLIC_SITE_URL, then AUTH_URL / NEXTAUTH_URL, then MainNet default.
 */
export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://app.helvex.cc";
  return raw.replace(/\/$/, "");
}

export const SITE = {
  name: "Helvex",
  brand: "Helvex — Trader-first RFQ",
  shortDescription:
    "Permissioned, trader-first RFQ on Canton Network. You set the minimum you'll receive.",
  description:
    "Helvex is a permissioned, trader-first RFQ desk on Canton Network (a Dream Capital product). You set the minimum you'll receive. Solvers bid to meet or beat it. A qualifying bid is not a guaranteed fill. KYC-verified traders swap CC, CBTC, and USDCx. Settlement is atomic. Loop is for deposit and withdraw.",
  marketingUrl: "https://helvex.cc",
  docsUrl: "https://helvex.gitbook.io/helvex-docs",
  twitter: "@Helvexcc",
  twitterUrl: "https://x.com/Helvexcc",
  parentOrg: "Dream Capital",
} as const;
