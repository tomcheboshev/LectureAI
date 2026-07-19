<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />

    <template v-if="post">
      <div class="max-w-3xl mx-auto px-6 pt-8">
        <Breadcrumbs :items="crumbs" />
      </div>

      <article class="max-w-3xl mx-auto px-6 pt-8 pb-24">
        <p class="text-xs font-semibold text-primary uppercase tracking-wide mb-3">{{ formatDate(post.date) }}</p>
        <h1 class="font-display font-extrabold text-3xl sm:text-4xl mb-6">{{ post.title }}</h1>
        <div class="rich-content-block" v-html="renderMarkdown(post.body)"></div>
      </article>
    </template>

    <div v-else class="max-w-3xl mx-auto px-6 py-24 text-center">
      <p class="text-slate-500 dark:text-slate-400">{{ t("blogPage.notFound") }}</p>
      <RouterLink to="/blog" class="text-primary hover:underline font-medium">{{ t("marketing.nav.blog") }}</RouterLink>
    </div>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { renderMarkdown } from "../composables/useMarkdown.js";
import { breadcrumbListSchema, articleSchema } from "../seo/schema.js";
import { parseFrontmatter } from "../utils/parseFrontmatter.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const route = useRoute();
const { t, lang } = useI18n();

const rawPosts = import.meta.glob("../content/blog/*.md", { query: "?raw", import: "default", eager: true });
const allPosts = Object.values(rawPosts).map((raw) => parseFrontmatter(raw));
const post = computed(() => {
  const found = allPosts.find((p) => p.data.slug === route.params.slug);
  return found ? { ...found.data, body: found.content } : null;
});

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "long", year: "numeric" });
}

const crumbs = computed(() => [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.blog"), path: "/blog" },
  ...(post.value ? [{ label: post.value.title, path: `/blog/${post.value.slug}` }] : []),
]);

useSeoMeta({
  title: post.value ? `${post.value.title} — LectureAI` : t("blogPage.notFound"),
  description: post.value?.description || t("seo.blog.description"),
  canonicalPath: `/blog/${route.params.slug}`,
  ogType: "article",
  // Defaults to a per-post dynamic OG image (via the /api/og endpoint,
  // rendered with this post's real title) rather than the generic
  // og-default.png every other page falls back to — a blog post's social
  // card should show what the post is actually about.
  ogImage: post.value?.ogImage || (post.value ? `/api/og?title=${encodeURIComponent(post.value.title)}` : undefined),
  structuredData: post.value ? [breadcrumbListSchema(crumbs.value), articleSchema(post.value)] : [],
});
</script>
