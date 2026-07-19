<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-3xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <section class="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <div class="text-center mb-12">
        <h1 class="font-display font-extrabold text-4xl sm:text-5xl mb-4">{{ t("faqPage.heading") }}</h1>
        <p class="text-lg text-slate-500 dark:text-slate-400">{{ t("faqPage.subheading") }}</p>
      </div>

      <!-- Rendered flat (not accordion-only) so full text is visible to
           crawlers, not hidden behind a click. -->
      <div class="flex flex-col gap-4">
        <div v-for="item in allFaq" :key="item.q" class="rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-5">
          <h2 class="font-semibold mb-2">{{ item.q }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ item.a }}</p>
        </div>
      </div>

      <div class="text-center mt-12">
        <RouterLink to="/contact" class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">
          {{ t("marketing.nav.contactUs") }} <ArrowRightIcon class="w-4 h-4" />
        </RouterLink>
      </div>
    </section>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRightIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema, faqPageSchema } from "../seo/schema.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const { t } = useI18n();

const faqKeys = [
  "landing.faq.timestamps",
  "landing.faq.whatToPaste",
  "landing.faq.followUp",
  "landing.faq.dataPrivate",
  "faqPage.extra.fileTypes",
  "faqPage.extra.cancel",
  "faqPage.extra.accuracy",
  "faqPage.extra.languages",
];
const allFaq = computed(() => faqKeys.map((key) => ({ q: t(`${key}.q`), a: t(`${key}.a`) })));

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.faq"), path: "/faq" },
];

useSeoMeta({
  title: t("seo.faq.title"),
  description: t("seo.faq.description"),
  canonicalPath: "/faq",
  structuredData: [breadcrumbListSchema(crumbs), faqPageSchema(allFaq.value)],
});
</script>
