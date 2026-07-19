// Schema.org / JSON-LD builder functions. Pure — each returns a plain
// object handed to useSeoMeta's structuredData array, which serializes it
// into a <script type="application/ld+json"> tag. Kept as small,
// independent builders (not one big generator) so each page only pulls in
// the schema types it actually needs.
const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://example.com").replace(/\/$/, "");
const SITE_NAME = "LectureAI";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

// `items` is the exact same array passed to the visible <Breadcrumbs>
// component — sharing one array means the JSON-LD can never drift from
// what's actually rendered on the page.
export function breadcrumbListSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// Offers built from constants/pricing.js — the same single source of truth
// PricingPage.vue and UpgradeModal.vue both read from, so this can't drift
// into a third hardcoded copy of the numbers.
export function softwareApplicationSchema(pricingPlans) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    offers: Object.entries(pricingPlans).map(([plan, price]) => ({
      "@type": "Offer",
      name: plan,
      price: price.toFixed(2),
      priceCurrency: "USD",
    })),
  };
}

export function articleSchema({ title, description, date, slug, ogImage }) {
  // Same fallback chain as BlogPostPage.vue's useSeoMeta ogImage: a
  // per-post dynamic image built from the real title beats the generic
  // og-default.png, so the schema's `image` and the actual og:image meta
  // tag never disagree with each other.
  const resolvedImage = ogImage || `/api/og?title=${encodeURIComponent(title)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: date,
    url: `${SITE_URL}/blog/${slug}`,
    image: resolvedImage.startsWith("http") ? resolvedImage : `${SITE_URL}${resolvedImage}`,
    publisher: { "@type": "Organization", name: SITE_NAME },
  };
}

export function faqPageSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
