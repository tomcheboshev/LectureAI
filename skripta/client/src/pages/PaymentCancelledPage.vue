<template>
  <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
    <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 mb-5">
      <XCircleIcon class="w-9 h-9" />
    </span>
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-2">{{ t("payment.cancelled.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">{{ t("payment.cancelled.body") }}</p>

    <div class="flex flex-col gap-2.5">
      <button
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
        @click="upgrade.show()"
      >
        {{ t("payment.cancelled.tryAgain") }}
      </button>
      <RouterLink
        to="/pricing"
        class="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold hover:border-slate-300 transition"
      >
        {{ t("payment.cancelled.returnToPricing") }}
      </RouterLink>
      <RouterLink to="/dashboard" class="text-sm font-semibold text-slate-500 hover:text-primary transition mt-1">
        {{ t("payment.cancelled.continueFree") }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { XCircleIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useUpgradeStore } from "../stores/upgrade.js";

const { t } = useI18n();
const upgrade = useUpgradeStore();
</script>
