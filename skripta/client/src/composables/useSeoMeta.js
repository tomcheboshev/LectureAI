import { useHead, useSeoMeta as useUnheadSeoMeta } from "@unhead/vue";

// Falls back to a placeholder if VITE_SITE_URL isn't set yet — matches the
// same "clearly bracketed placeholder, not an invented-but-real-looking
// value" convention used in the Privacy Policy/Terms content.
const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://example.com").replace(/\/$/, "");
const SITE_NAME = "LectureAI";

// Every public marketing page calls this once from <script setup>. Thin
// wrapper over unhead's own useSeoMeta (title/description/OG/Twitter field
// mapping) plus useHead for the two things unhead's flat SEO API doesn't
// cover: an absolute canonical <link> and JSON-LD <script> tags. Reactive —
// SPA navigation between these pages after hydration re-runs this and
// unhead handles de-duplication/cleanup of the previous page's tags itself,
// which is exactly why this wraps unhead instead of hand-rolling
// document.head mutation.
export function useSeoMeta({ title, description, canonicalPath, ogImage, ogType = "website", structuredData = [] }) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const imageUrl = ogImage ? (ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`) : `${SITE_URL}/og-default.png`;

  useUnheadSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogSiteName: SITE_NAME,
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: imageUrl,
  });

  useHead({
    link: [{ rel: "canonical", href: canonicalUrl }],
    script: structuredData.map((schema) => ({
      type: "application/ld+json",
      innerHTML: JSON.stringify(schema),
    })),
  });
}
