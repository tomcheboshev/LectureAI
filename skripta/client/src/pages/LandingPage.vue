<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white overflow-x-hidden">
    <!-- Nav — shared with every other marketing page (Features/Pricing/Blog/
         FAQ/About links + mobile drawer) so Landing isn't the one page on
         the site with no way to reach them. The in-page anchor sections
         below (#features/#how-it-works/#faq) stay as page CONTENT; they're
         no longer duplicated as nav shortcuts now that Features/FAQ are
         real standalone pages. -->
    <MarketingHeader />

    <!-- Hero -->
    <section class="relative max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
      <div class="absolute inset-x-0 -top-20 -z-10 flex justify-center blur-3xl opacity-40 dark:opacity-25">
        <div class="w-[640px] h-[420px] bg-gradient-to-tr from-primary via-secondary to-accent rounded-full"></div>
      </div>

      <span class="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold px-3 py-1 mb-6 animate-fade-up">
        <SparklesIcon class="w-3.5 h-3.5" /> {{ t("landing.hero.badge") }}
      </span>
      <h1 class="font-display font-extrabold text-4xl sm:text-6xl leading-[1.05] tracking-tight mb-6 animate-fade-up" style="animation-delay:.05s">
        {{ t("landing.hero.titleLine1") }}
        <span class="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">{{ t("landing.hero.titleHighlight") }}</span>
      </h1>
      <p class="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 animate-fade-up" style="animation-delay:.1s">
        {{ t("landing.hero.subtitle") }}
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3 animate-fade-up" style="animation-delay:.15s">
        <button class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover hover:-translate-y-0.5 transition" @click="router.push('/new')">
          {{ t("landing.hero.generateCta") }} <ArrowRightIcon class="w-5 h-5" />
        </button>
        <button class="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-border-dark px-6 py-3.5 text-base font-semibold hover:bg-white dark:hover:bg-white/5 transition" @click="router.push('/dashboard')">
          {{ t("landing.hero.viewDashboard") }}
        </button>
      </div>

      <!-- floating mock cards -->
      <div class="relative mt-20 max-w-4xl mx-auto hidden md:block h-64">
        <div class="absolute left-0 top-6 w-56 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark shadow-xl p-4 text-left animate-float">
          <p class="text-xs font-semibold text-primary mb-1">{{ t("landing.hero.mockQuizLabel") }}</p>
          <p class="text-sm font-medium">{{ t("landing.hero.mockQuizQuestion") }}</p>
        </div>
        <div class="absolute right-0 top-0 w-60 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark shadow-xl p-4 text-left animate-float" style="animation-delay:1.4s">
          <p class="text-xs font-semibold text-secondary mb-1">{{ t("landing.hero.mockFlashcardLabel") }}</p>
          <p class="text-sm font-medium">{{ t("landing.hero.mockFlashcardTerm") }}</p>
          <p class="text-xs text-slate-500 mt-1">{{ t("landing.hero.mockFlashcardDef") }}</p>
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 bottom-0 w-64 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark shadow-xl p-4 text-left animate-float" style="animation-delay:0.7s">
          <p class="text-xs font-semibold text-accent mb-1">{{ t("landing.hero.mockAskLabel") }}</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">{{ t("landing.hero.mockAskQuestion") }}</p>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="max-w-6xl mx-auto px-6 py-20">
      <div class="text-center mb-14">
        <h2 class="font-display font-bold text-3xl sm:text-4xl mb-3">{{ t("landing.features.heading") }}</h2>
        <p class="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">{{ t("landing.features.subheading") }}</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="f in features" :key="f.key" class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6 hover:-translate-y-1 hover:shadow-lg transition">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4" :class="f.tint">
            <component :is="f.icon" class="w-5.5 h-5.5" :class="f.color" />
          </div>
          <h3 class="font-display font-bold mb-1.5">{{ t(`landing.features.${f.key}.title`) }}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t(`landing.features.${f.key}.desc`) }}</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="max-w-5xl mx-auto px-6 py-20">
      <div class="text-center mb-14">
        <h2 class="font-display font-bold text-3xl sm:text-4xl mb-3">{{ t("landing.howItWorks.heading") }}</h2>
        <p class="text-slate-500 dark:text-slate-400">{{ t("landing.howItWorks.subheading") }}</p>
      </div>
      <div class="grid sm:grid-cols-3 gap-8">
        <div v-for="(s, i) in steps" :key="s.key" class="relative text-center">
          <div class="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-primary to-secondary text-white font-display font-bold flex items-center justify-center mb-4">
            {{ i + 1 }}
          </div>
          <h3 class="font-display font-bold mb-1.5">{{ t(`landing.howItWorks.${s.key}.title`) }}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ t(`landing.howItWorks.${s.key}.desc`) }}</p>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="max-w-6xl mx-auto px-6 py-20">
      <div class="text-center mb-14">
        <h2 class="font-display font-bold text-3xl sm:text-4xl mb-3">{{ t("landing.testimonials.heading") }}</h2>
      </div>
      <div class="grid sm:grid-cols-3 gap-5">
        <div v-for="ts in testimonials" :key="ts.key" class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-6">
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">"{{ t(`landing.testimonials.${ts.key}.quote`) }}"</p>
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold">{{ ts.initials }}</div>
            <div>
              <p class="text-sm font-semibold">{{ ts.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t(`landing.testimonials.${ts.key}.role`) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="max-w-3xl mx-auto px-6 py-20">
      <h2 class="font-display font-bold text-3xl sm:text-4xl mb-10 text-center">{{ t("landing.faq.heading") }}</h2>
      <div class="flex flex-col gap-3">
        <details v-for="f in faq" :key="f.key" class="group rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-5 open:shadow-md transition">
          <summary class="flex items-center justify-between cursor-pointer font-semibold list-none">
            {{ t(`landing.faq.${f.key}.q`) }}
            <ChevronDownIcon class="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-3">{{ t(`landing.faq.${f.key}.a`) }}</p>
        </details>
      </div>
    </section>

    <!-- CTA -->
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
  ArrowRightIcon, SparklesIcon, ChevronDownIcon,
  BookOpenIcon, AcademicCapIcon, ChatBubbleLeftRightIcon,
  RectangleStackIcon, ClipboardDocumentCheckIcon, ListBulletIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { softwareApplicationSchema } from "../seo/schema.js";
import { PRICING_PLANS } from "../constants/pricing.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";

const router = useRouter();
const { t } = useI18n();

useSeoMeta({
  title: t("seo.landing.title"),
  description: t("seo.landing.description"),
  canonicalPath: "/",
  structuredData: [softwareApplicationSchema(PRICING_PLANS)],
});

const features = [
  { key: "chapterSummaries", icon: BookOpenIcon, tint: "bg-primary/10", color: "text-primary" },
  { key: "coreConcepts", icon: AcademicCapIcon, tint: "bg-secondary/10", color: "text-secondary" },
  { key: "autoQuiz", icon: ClipboardDocumentCheckIcon, tint: "bg-accent/10", color: "text-accent" },
  { key: "flashcards", icon: RectangleStackIcon, tint: "bg-success/10", color: "text-success" },
  { key: "practiceTasks", icon: ListBulletIcon, tint: "bg-warning/10", color: "text-warning" },
  { key: "askLecture", icon: ChatBubbleLeftRightIcon, tint: "bg-danger/10", color: "text-danger" },
];

const steps = [
  { key: "pasteTranscript" },
  { key: "aiBuilds" },
  { key: "studyYourWay" },
];

const testimonials = [
  { key: "ana", name: "Ana K.", initials: "AK" },
  { key: "marko", name: "Marko P.", initials: "MP" },
  { key: "ivana", name: "Ivana T.", initials: "IT" },
];

const faq = [
  { key: "timestamps" },
  { key: "whatToPaste" },
  { key: "followUp" },
  { key: "dataPrivate" },
];
</script>
