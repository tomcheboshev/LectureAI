<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-3xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <article class="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <h1 class="font-display font-extrabold text-4xl mb-4">{{ t("marketing.nav.privacy") }}</h1>

      <div class="rounded-xl border border-warning/30 bg-warning/5 text-sm px-4 py-3 mb-8 text-slate-700 dark:text-slate-200">
        {{ t("legal.placeholderNotice") }}
      </div>

      <div class="rich-content-block" v-html="renderMarkdown(privacyMd)"></div>
    </article>

    <MarketingFooter />
  </div>
</template>

<script setup>
import privacyMd from "../content/legal/privacy.md?raw";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { renderMarkdown } from "../composables/useMarkdown.js";
import { breadcrumbListSchema } from "../seo/schema.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const { t } = useI18n();

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.privacy"), path: "/privacy" },
];

useSeoMeta({
  title: t("seo.privacy.title"),
  description: t("seo.privacy.description"),
  canonicalPath: "/privacy",
  structuredData: [breadcrumbListSchema(crumbs)],
});
</script>
