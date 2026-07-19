<template>
  <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
    <template v-if="loading">
      <ArrowPathIcon class="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t("payment.success.confirming") }}</p>
    </template>

    <template v-else>
      <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 text-success mb-5">
        <CheckCircleIcon class="w-9 h-9" />
      </span>
      <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-2">{{ t("payment.success.title") }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">{{ t("payment.success.subtitle") }}</p>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5 text-left mb-8 flex flex-col gap-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-slate-400">{{ t("payment.success.currentPlan") }}</span>
          <span class="font-semibold capitalize text-slate-800 dark:text-slate-100">{{ sub?.plan || "pro" }}</span>
        </div>
        <div v-if="sub?.currentPeriodEnd" class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-slate-400">{{ t("payment.success.renewalDate") }}</span>
          <span class="font-semibold text-slate-800 dark:text-slate-100">{{ formatDate(sub.currentPeriodEnd) }}</span>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-2.5 justify-center">
        <a
          v-if="latestInvoiceUrl"
          :href="latestInvoiceUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold hover:border-slate-300 transition"
        >
          <DocumentTextIcon class="w-4 h-4" /> {{ t("payment.success.viewInvoice") }}
        </a>
        <RouterLink to="/dashboard" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">
          {{ t("payment.success.goToDashboard") }} <ArrowRightIcon class="w-4 h-4" />
        </RouterLink>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { CheckCircleIcon, ArrowRightIcon, ArrowPathIcon, DocumentTextIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useBillingStore } from "../stores/billing.js";
import { useAuthStore } from "../stores/auth.js";
import { api } from "../services/api.js";

const { t, lang } = useI18n();
const route = useRoute();
const router = useRouter();
const billing = useBillingStore();
const auth = useAuthStore();

const loading = ref(true);
const sub = computed(() => billing.subscription);
const latestInvoiceUrl = computed(() => billing.invoices[0]?.hostedInvoiceUrl || null);

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

// Checkout's own payment_status is authoritative for "did the card get
// charged" — the webhook pipeline remains authoritative for actual
// entitlement (plan/status on the User doc), which can lag the redirect by
// a second or two. Poll briefly for that to catch up before showing
// success; if it never does, fall through to /payment/pending rather than
// showing a false "you're on Pro now" the moment the webhook is merely slow.
async function pollUntilResolved() {
  const sessionId = route.query.session_id;
  if (!sessionId) {
    router.replace({ name: "payment-pending" });
    return;
  }
  const deadline = Date.now() + 10000;
  for (;;) {
    let session;
    try {
      session = await api.getCheckoutSession(sessionId);
    } catch {
      router.replace({ name: "payment-pending" });
      return;
    }
    if (session.paymentStatus === "unpaid") {
      router.replace({ name: "payment-cancelled" });
      return;
    }
    if (session.subscriptionStatus === "active" || session.subscriptionStatus === "trialing") {
      await Promise.all([auth.fetchMe(), billing.fetchSubscription(), billing.fetchInvoices().catch(() => {})]);
      loading.value = false;
      return;
    }
    if (Date.now() > deadline) {
      router.replace({ name: "payment-pending" });
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

onMounted(pollUntilResolved);
</script>
