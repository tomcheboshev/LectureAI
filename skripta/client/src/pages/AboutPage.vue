<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-3xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <section class="max-w-3xl mx-auto px-6 pt-8 pb-24">
      <h1 class="font-display font-extrabold text-4xl sm:text-5xl mb-6">{{ t("aboutPage.heading") }}</h1>

      <div class="prose-content flex flex-col gap-5 text-slate-600 dark:text-slate-300">
        <p>{{ t("aboutPage.p1") }}</p>
        <p>{{ t("aboutPage.p2") }}</p>
        <p>{{ t("aboutPage.p3") }}</p>
      </div>

      <div class="grid sm:grid-cols-3 gap-5 mt-12">
        <div v-for="v in values" :key="v.key" class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6">
          <component :is="v.icon" class="w-6 h-6 text-primary mb-3" />
          <h2 class="font-display font-bold mb-1.5">{{ t(`aboutPage.values.${v.key}.title`) }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t(`aboutPage.values.${v.key}.desc`) }}</p>
        </div>
      </div>

      <div class="text-center mt-14">
        <button class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover hover:-translate-y-0.5 transition" @click="router.push('/new')">
          {{ t("landing.hero.generateCta") }} <ArrowRightIcon class="w-5 h-5" />
        </button>
      </div>
    </section>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { ArrowRightIcon, AcademicCapIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema } from "../seo/schema.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const router = useRouter();
const { t } = useI18n();

const values = [
  { key: "grounded", icon: ShieldCheckIcon },
  { key: "depth", icon: AcademicCapIcon },
  { key: "speed", icon: SparklesIcon },
];

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.about"), path: "/about" },
];

useSeoMeta({
  title: t("seo.about.title"),
  description: t("seo.about.description"),
  canonicalPath: "/about",
  structuredData: [breadcrumbListSchema(crumbs)],
});
</script>
