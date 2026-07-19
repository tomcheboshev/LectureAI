<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-6xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <section class="max-w-6xl mx-auto px-6 pt-8 pb-20">
      <div class="text-center mb-14">
        <h1 class="font-display font-extrabold text-4xl sm:text-5xl mb-4">{{ t("featuresPage.heading") }}</h1>
        <p class="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{{ t("featuresPage.subheading") }}</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="f in features" :key="f.key" class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4" :class="f.tint">
            <component :is="f.icon" class="w-5.5 h-5.5" :class="f.color" />
          </div>
          <h2 class="font-display font-bold mb-1.5">{{ t(`landing.features.${f.key}.title`) }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t(`landing.features.${f.key}.desc`) }}</p>
        </div>
      </div>
    </section>

    <section class="max-w-4xl mx-auto px-6 pb-24">
      <div class="rounded-3xl bg-gradient-to-br from-primary to-secondary px-8 py-14 text-center text-white shadow-xl shadow-primary/20">
        <h2 class="font-display font-bold text-3xl sm:text-4xl mb-3">{{ t("landing.cta.heading") }}</h2>
        <p class="text-white/80 mb-8 max-w-lg mx-auto">{{ t("landing.cta.subheading") }}</p>
        <button class="inline-flex items-center gap-2 rounded-xl bg-white text-primary px-6 py-3.5 font-semibold hover:-translate-y-0.5 transition" @click="router.push('/new')">
          {{ t("landing.hero.generateCta") }} <ArrowRightIcon class="w-5 h-5" />
        </button>
      </div>
    </section>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import {
  ArrowRightIcon,
  BookOpenIcon, AcademicCapIcon, ChatBubbleLeftRightIcon,
  RectangleStackIcon, ClipboardDocumentCheckIcon, ListBulletIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema } from "../seo/schema.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const router = useRouter();
const { t } = useI18n();

const features = [
  { key: "chapterSummaries", icon: BookOpenIcon, tint: "bg-primary/10", color: "text-primary" },
  { key: "coreConcepts", icon: AcademicCapIcon, tint: "bg-secondary/10", color: "text-secondary" },
  { key: "autoQuiz", icon: ClipboardDocumentCheckIcon, tint: "bg-accent/10", color: "text-accent" },
  { key: "flashcards", icon: RectangleStackIcon, tint: "bg-success/10", color: "text-success" },
  { key: "practiceTasks", icon: ListBulletIcon, tint: "bg-warning/10", color: "text-warning" },
  { key: "askLecture", icon: ChatBubbleLeftRightIcon, tint: "bg-danger/10", color: "text-danger" },
];

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.features"), path: "/features" },
];

useSeoMeta({
  title: t("seo.features.title"),
  description: t("seo.features.description"),
  canonicalPath: "/features",
  structuredData: [breadcrumbListSchema(crumbs)],
});
</script>
