<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="upgrade.open" class="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="upgrade.hide()"></div>
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 animate-fade-up">
          <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary text-white mb-4">
            <SparklesIcon class="w-6 h-6" />
          </span>
          <h3 class="font-display font-extrabold text-xl text-slate-900 dark:text-white mb-1.5">{{ t("upgradeModal.title") }}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-5">{{ upgrade.message }}</p>

          <ul class="flex flex-col gap-2 mb-5">
            <li v-for="f in proFeatures" :key="f" class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckIcon class="w-4 h-4 text-success shrink-0 mt-0.5" /> {{ t(f) }}
            </li>
          </ul>

          <!-- Monthly / Annual toggle -->
          <div class="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 mb-3">
            <button
              type="button"
              class="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              :class="interval === 'monthly' ? 'bg-white dark:bg-surface-dark shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'"
              @click="interval = 'monthly'"
            >
              {{ t("upgradeModal.billing.monthly") }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg py-2 text-sm font-semibold transition relative"
              :class="interval === 'annual' ? 'bg-white dark:bg-surface-dark shadow text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'"
              @click="interval = 'annual'"
            >
              {{ t("upgradeModal.billing.annual") }}
              <span class="absolute -top-2 -right-1 badge badge-success !text-[10px] !px-1.5 !py-0.5">{{ t("upgradeModal.billing.annualSave") }}</span>
            </button>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 mb-4 cursor-pointer select-none">
            <input v-model="isStudent" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" />
            {{ t("upgradeModal.billing.student") }}
          </label>

          <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3 mb-4 flex items-baseline gap-1">
            <span class="font-display font-extrabold text-2xl text-slate-900 dark:text-white">${{ displayPrice }}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400">{{ t(interval === "monthly" ? "upgradeModal.billing.priceSuffixMonth" : "upgradeModal.billing.priceSuffixYear") }}</span>
          </div>

          <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5 mb-4">{{ error }}</div>

          <div class="flex gap-2">
            <button class="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition" @click="upgrade.hide()">
              {{ t("upgradeModal.maybeLater") }}
            </button>
            <button
              :disabled="loading"
              class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition"
              @click="doCheckout"
            >
              <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
              {{ loading ? t("upgradeModal.upgrading") : t("upgradeModal.billing.subscribe") }}
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-3 text-center">{{ t("upgradeModal.billing.trialNote", { days: TRIAL_DAYS }) }}</p>
          <p class="text-[11px] text-slate-400 mt-1 text-center">{{ t("upgradeModal.disclaimer") }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from "vue";
import { SparklesIcon, CheckIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useUpgradeStore } from "../stores/upgrade.js";
import { useBillingStore } from "../stores/billing.js";
import { useI18n } from "../composables/useI18n.js";
import { useModalBehavior } from "../composables/useModalBehavior.js";

const upgrade = useUpgradeStore();
const billing = useBillingStore();
const { t } = useI18n();
const loading = ref(false);
const error = ref("");
useModalBehavior(
  computed(() => upgrade.open),
  () => upgrade.hide()
);

const proFeatures = [
  "upgradeModal.features.unlimitedPackages",
  "upgradeModal.features.moreFiles",
  "upgradeModal.features.unlimitedChat",
  "upgradeModal.features.priorityQueue",
  "upgradeModal.features.noWatermark",
];

// Trial length + display prices mirror scripts/stripe-setup.mjs — the
// actual charge always comes from the real Stripe Price server-side
// regardless of what's shown here, but keep these in sync if pricing
// changes so the modal isn't misleading.
const TRIAL_DAYS = 7;
const DISPLAY_PRICES = { monthly: 9.99, annual: 79, monthly_student: 4.99, annual_student: 39.5 };

const interval = ref("monthly"); // "monthly" | "annual"
const isStudent = ref(false);

const planKey = computed(() => {
  if (interval.value === "monthly") return isStudent.value ? "monthly_student" : "monthly";
  return isStudent.value ? "annual_student" : "annual";
});
const displayPrice = computed(() => DISPLAY_PRICES[planKey.value].toFixed(2).replace(/\.00$/, ""));

async function doCheckout() {
  error.value = "";
  loading.value = true;
  try {
    await billing.startCheckout(planKey.value);
    // startCheckout redirects the browser away on success — loading stays
    // true through the navigation so the button doesn't flicker back.
  } catch (e) {
    error.value = e.message;
    loading.value = false;
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
