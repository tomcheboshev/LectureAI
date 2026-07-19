<template>
  <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
    <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 mb-5">
      <CheckIcon class="w-9 h-9" />
    </span>
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-2">{{ t("subscription.cancelled.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">
      {{ keepsAccess ? t("subscription.cancelled.bodyPeriodEnd", { date: formattedDate }) : t("subscription.cancelled.bodyImmediate") }}
    </p>

    <div class="flex flex-col gap-2.5">
      <button
        v-if="keepsAccess"
        :disabled="resuming"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition"
        @click="doResume"
      >
        <ArrowPathIcon v-if="resuming" class="w-4 h-4 animate-spin" /> {{ resuming ? t("subscription.cancelled.resuming") : t("subscription.cancelled.resume") }}
      </button>
      <RouterLink
        to="/dashboard"
        class="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold hover:border-slate-300 transition"
      >
        {{ t("subscription.cancelled.viewDashboard") }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { CheckIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useBillingStore } from "../stores/billing.js";
import { useToastStore } from "../stores/toast.js";
import { reportApiError } from "../composables/useApiError.js";

const { t, lang } = useI18n();
const router = useRouter();
const billing = useBillingStore();
const toast = useToastStore();

// Reads the just-cancelled state straight from the billing store (already
// merged in by billing.cancel()'s response when this page was navigated to)
// rather than re-fetching — the whole point of routing here immediately
// after the cancel action resolves.
const sub = computed(() => billing.subscription);
const keepsAccess = computed(() => sub.value?.status !== "canceled" && Boolean(sub.value?.cancelAtPeriodEnd));
const formattedDate = computed(() => (sub.value?.currentPeriodEnd ? new Date(sub.value.currentPeriodEnd).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" }) : ""));

const resuming = ref(false);
async function doResume() {
  resuming.value = true;
  try {
    await billing.resume();
    toast.success(t("subscription.resumed.title"));
    router.push("/settings");
  } catch (e) {
    reportApiError(e);
  } finally {
    resuming.value = false;
  }
}
</script>
