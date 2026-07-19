<template>
  <div class="bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white min-h-screen">
    <MarketingHeader />
    <div class="max-w-6xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <section class="max-w-5xl mx-auto px-6 pt-8 pb-20">
      <div class="text-center mb-14">
        <h1 class="font-display font-extrabold text-4xl sm:text-5xl mb-4">{{ t("pricingPage.heading") }}</h1>
        <p class="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{{ t("pricingPage.subheading") }}</p>
      </div>

      <div class="flex justify-center mb-10">
        <div class="inline-flex rounded-xl bg-slate-100 dark:bg-white/5 p-1">
          <button
            type="button"
            class="rounded-lg px-5 py-2 text-sm font-semibold transition"
            :class="interval === 'monthly' ? 'bg-white dark:bg-surface-dark shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'"
            @click="interval = 'monthly'"
          >
            {{ t("upgradeModal.billing.monthly") }}
          </button>
          <button
            type="button"
            class="rounded-lg px-5 py-2 text-sm font-semibold transition relative"
            :class="interval === 'annual' ? 'bg-white dark:bg-surface-dark shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'"
            @click="interval = 'annual'"
          >
            {{ t("upgradeModal.billing.annual") }}
            <span class="absolute -top-2 -right-1 badge badge-success !text-[10px] !px-1.5 !py-0.5">{{ t("upgradeModal.billing.annualSave") }}</span>
          </button>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <!-- Free -->
        <div class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-8">
          <h2 class="font-display font-bold text-xl mb-1">{{ t("pricingPage.free.name") }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("pricingPage.free.tagline") }}</p>
          <p class="font-display font-extrabold text-4xl mb-6">$0</p>
          <ul class="flex flex-col gap-2.5 mb-8">
            <li v-for="f in freeFeatures" :key="f" class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckIcon class="w-4 h-4 text-success shrink-0 mt-0.5" /> {{ t(f) }}
            </li>
          </ul>
          <button class="w-full px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="router.push('/register')">
            {{ t("pricingPage.free.cta") }}
          </button>
        </div>

        <!-- Pro -->
        <div class="rounded-2xl bg-white dark:bg-surface-dark border-2 border-primary p-8 relative">
          <span class="absolute -top-3 left-1/2 -translate-x-1/2 badge badge-primary">{{ t("pricingPage.pro.badge") }}</span>
          <h2 class="font-display font-bold text-xl mb-1">{{ t("pricingPage.pro.name") }}</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("pricingPage.pro.tagline") }}</p>
          <div class="flex items-baseline gap-1 mb-1">
            <p class="font-display font-extrabold text-4xl">${{ displayPrice }}</p>
            <span class="text-sm text-slate-500 dark:text-slate-400">{{ t(interval === "monthly" ? "upgradeModal.billing.priceSuffixMonth" : "upgradeModal.billing.priceSuffixYear") }}</span>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-6 cursor-pointer select-none">
            <input v-model="isStudent" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" />
            {{ t("upgradeModal.billing.student") }}
          </label>
          <ul class="flex flex-col gap-2.5 mb-8">
            <li v-for="f in proFeatures" :key="f" class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckIcon class="w-4 h-4 text-success shrink-0 mt-0.5" /> {{ t(f) }}
            </li>
          </ul>
          <button class="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition" @click="router.push('/register')">
            {{ t("pricingPage.pro.cta", { days: TRIAL_DAYS }) }}
          </button>
        </div>
      </div>

      <p class="text-center text-sm text-slate-400 mt-10">{{ t("pricingPage.footnote") }}</p>
    </section>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { CheckIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema, softwareApplicationSchema } from "../seo/schema.js";
import { TRIAL_DAYS, PRICING_PLANS } from "../constants/pricing.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const router = useRouter();
const { t } = useI18n();

const interval = ref("monthly");
const isStudent = ref(false);
const planKey = computed(() => {
  if (interval.value === "monthly") return isStudent.value ? "monthly_student" : "monthly";
  return isStudent.value ? "annual_student" : "annual";
});
const displayPrice = computed(() => PRICING_PLANS[planKey.value].toFixed(2).replace(/\.00$/, ""));

const freeFeatures = ["pricingPage.free.f1", "pricingPage.free.f2", "pricingPage.free.f3", "pricingPage.free.f4"];
const proFeatures = [
  "upgradeModal.features.unlimitedPackages",
  "upgradeModal.features.moreFiles",
  "upgradeModal.features.unlimitedChat",
  "upgradeModal.features.priorityQueue",
  "upgradeModal.features.noWatermark",
];

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.pricing"), path: "/pricing" },
];

useSeoMeta({
  title: t("seo.pricing.title"),
  description: t("seo.pricing.description"),
  canonicalPath: "/pricing",
  structuredData: [breadcrumbListSchema(crumbs), softwareApplicationSchema(PRICING_PLANS)],
});
</script>
