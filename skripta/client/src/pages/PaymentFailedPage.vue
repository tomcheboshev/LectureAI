<template>
  <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
    <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 text-danger mb-5">
      <ExclamationTriangleIcon class="w-9 h-9" />
    </span>
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-2">{{ t("payment.failed.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400" :class="reason ? 'mb-2' : 'mb-6'">{{ hasIssue ? t("payment.failed.body") : t("payment.failed.noIssue") }}</p>
    <p v-if="reason" class="text-sm text-danger mb-6">{{ t("payment.failed.reasonPrefix") }} {{ reason }}</p>

    <div class="flex flex-col gap-2.5">
      <button
        v-if="retryableInvoiceId"
        :disabled="retrying"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition"
        @click="doRetry"
      >
        <ArrowPathIcon v-if="retrying" class="w-4 h-4 animate-spin" /> {{ retrying ? t("payment.failed.retrying") : t("payment.failed.retryPayment") }}
      </button>
      <RouterLink
        to="/settings/support"
        class="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold hover:border-slate-300 transition"
      >
        {{ t("payment.failed.contactSupport") }}
      </RouterLink>
      <RouterLink to="/dashboard" class="text-sm font-semibold text-slate-500 hover:text-primary transition mt-1">
        {{ t("payment.success.goToDashboard") }}
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { ExclamationTriangleIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useBillingStore } from "../stores/billing.js";
import { useToastStore } from "../stores/toast.js";
import { reportApiError } from "../composables/useApiError.js";
import { api } from "../services/api.js";

const { t } = useI18n();
const billing = useBillingStore();
const toast = useToastStore();

const hasIssue = computed(() => {
  const status = billing.subscription?.subscriptionStatus;
  return status === "past_due" || status === "unpaid" || Boolean(billing.subscription?.inGracePeriod);
});
// Stripe doesn't expose a clean, always-present human-readable decline
// reason on the subscription/user record we store — the most specific
// signal reliably available here is the status itself.
const reason = computed(() => {
  if (billing.subscription?.subscriptionStatus === "past_due") return t("settings.billing.status.past_due");
  return "";
});
const retryableInvoiceId = computed(() => billing.invoices.find((inv) => inv.status === "open")?.stripeInvoiceId || null);

const retrying = ref(false);
async function doRetry() {
  retrying.value = true;
  try {
    await api.retryInvoice(retryableInvoiceId.value);
    await Promise.all([billing.fetchSubscription(), billing.fetchInvoices()]);
    toast.success(t("payment.failed.retrySuccess"));
  } catch (e) {
    reportApiError(e);
  } finally {
    retrying.value = false;
  }
}

onMounted(async () => {
  try {
    await Promise.all([billing.fetchSubscription(), billing.fetchInvoices()]);
  } catch (e) {
    reportApiError(e);
  }
});
</script>
