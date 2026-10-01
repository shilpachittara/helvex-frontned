import { SITE, siteOrigin } from "../lib/site";

/** Organization + SoftwareApplication JSON-LD for the trading app. */
export function JsonLd() {
  const origin = siteOrigin();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: SITE.name,
        alternateName: ["Helvex Canton", "Helvex RFQ", "Helvex Canton Network"],
        url: SITE.marketingUrl,
        logo: {
          "@type": "ImageObject",
          url: `${origin}/icon-512.png`,
          width: 512,
          height: 512,
        },
        description: SITE.description,
        sameAs: [SITE.twitterUrl, SITE.docsUrl, origin, SITE.marketingUrl],
        parentOrganization: {
          "@type": "Organization",
          name: SITE.parentOrg,
        },
        knowsAbout: [
          "Canton Network",
          "RFQ trading",
          "atomic DvP settlement",
          "Canton Coin",
          "CBTC",
          "USDCx",
          "Loop wallet",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: SITE.brand,
        description: SITE.shortDescription,
        publisher: { "@id": `${origin}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#app`,
        name: SITE.name,
        alternateName: "Helvex Canton RFQ Desk",
        applicationCategory: "FinanceApplication",
        applicationSubCategory: "RFQ Trading Desk",
        operatingSystem: "Web",
        url: origin,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "0 bps Helvex app fee today; Canton network traffic may apply.",
        },
        description: SITE.description,
        featureList: [
          "Private RFQ swaps on Canton Network",
          "Firm executable quotes",
          "Atomic DvP settlement",
          "KYC-verified counterparties",
          "CC, CBTC, and USDCx markets",
          "Loop wallet deposit and withdraw",
          "HMAC trading API",
        ],
        screenshot: `${origin}/og-image.png`,
        publisher: { "@id": `${origin}/#organization` },
        isAccessibleForFree: true,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD is static site copy — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
