<template>
  <div class="max-w-md mx-auto px-4 sm:px-6 py-16 text-center">
    <span class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 text-warning mb-5">
      <ClockIcon class="w-9 h-9" />
    </span>
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-2">{{ t("payment.pending.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">{{ t("payment.pending.body") }}</p>
    <ArrowPathIcon class="w-5 h-5 mx-auto text-slate-400 animate-spin" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { ClockIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useBillingStore } from "../stores/billing.js";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";

const { t } = useI18n();
const router = useRouter();
const billing = useBillingStore();
const auth = useAuthStore();
const toast = useToastStore();

let timer = null;

// Goes straight to the dashboard (not /payment/success) once resolved —
// that page expects a session_id query param to independently verify
// against, which isn't available here and would just bounce back to this
// same pending page.
async function poll() {
  try {
    await billing.fetchSubscription();
    const status = billing.subscription?.subscriptionStatus;
    if (status === "active" || status === "trialing") {
      await auth.fetchMe();
      toast.success(t("payment.success.title"));
      router.replace("/dashboard");
    }
  } catch {
    // A transient poll failure isn't worth surfacing here — just try again
    // on the next tick.
  }
}

onMounted(() => {
  poll();
  timer = setInterval(poll, 4000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>
