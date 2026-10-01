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
  brand: "Helvex — Canton Network RFQ Desk",
  shortDescription:
    "Permissioned RFQ trading desk on Canton Network for CC, CBTC, and USDCx.",
  description:
    "Helvex is the permissioned RFQ desk on Canton Network (a Dream Capital product). KYC-verified traders swap CC, CBTC, and USDCx with firm quotes and atomic DvP settlement. Loop wallet for deposit/withdraw; Helvex trading ID for lock, fill, and settle.",
  marketingUrl: "https://helvex.cc",
  docsUrl: "https://helvex.gitbook.io/helvex-docs",
  twitter: "@Helvexcc",
  twitterUrl: "https://x.com/Helvexcc",
  parentOrg: "Dream Capital",
} as const;
