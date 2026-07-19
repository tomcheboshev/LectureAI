<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-4xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <section class="max-w-4xl mx-auto px-6 pt-8 pb-24">
      <div class="text-center mb-14">
        <h1 class="font-display font-extrabold text-4xl sm:text-5xl mb-4">{{ t("blogPage.heading") }}</h1>
        <p class="text-lg text-slate-500 dark:text-slate-400">{{ t("blogPage.subheading") }}</p>
      </div>

      <div class="flex flex-col gap-5">
        <RouterLink
          v-for="post in posts"
          :key="post.slug"
          :to="`/blog/${post.slug}`"
          class="block rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6 hover:-translate-y-0.5 hover:shadow-lg transition"
        >
          <p class="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{{ formatDate(post.date) }}</p>
          <h2 class="font-display font-bold text-xl mb-2">{{ post.title }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ post.description }}</p>
        </RouterLink>
      </div>
    </section>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema } from "../seo/schema.js";
import { parseFrontmatter } from "../utils/parseFrontmatter.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const { t, lang } = useI18n();

const rawPosts = import.meta.glob("../content/blog/*.md", { query: "?raw", import: "default", eager: true });
const posts = computed(() =>
  Object.values(rawPosts)
    .map((raw) => parseFrontmatter(raw).data)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
);

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "long", year: "numeric" });
}

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.blog"), path: "/blog" },
];

useSeoMeta({
  title: t("seo.blog.title"),
  description: t("seo.blog.description"),
  canonicalPath: "/blog",
  structuredData: [breadcrumbListSchema(crumbs)],
});
</script>
