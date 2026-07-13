<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-1">{{ t("nav.settings") }}</h1>
    <p class="text-slate-500 dark:text-slate-400 mb-8">{{ t("settings.pageSubtitle") }}</p>

    <!-- Profile -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.profile") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.profileDescription") }}</p>

      <form class="flex flex-col gap-4" @submit.prevent="saveProfile">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.name") }}</label>
          <input v-model="profileForm.name" maxlength="100" required class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.email") }}</label>
          <div class="flex items-center gap-2">
            <input :value="auth.user?.email" disabled class="input-field opacity-60 cursor-not-allowed" />
            <span v-if="auth.user?.emailVerified" class="badge badge-success shrink-0">{{ t("settings.verified") }}</span>
            <button v-else type="button" :disabled="resending" class="badge badge-warning shrink-0 hover:bg-warning/20 disabled:opacity-40 transition" @click="resendVerification">
              {{ resending ? t("settings.sending") : t("settings.verify") }}
            </button>
          </div>
        </div>
        <button :disabled="savingProfile" class="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition">
          {{ savingProfile ? t("settings.saving") : t("common.save") }}
        </button>
      </form>
    </section>

    <!-- Password -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.changePassword") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.passwordDescription") }}</p>

      <form class="flex flex-col gap-4" @submit.prevent="changePassword">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("settings.currentPassword") }}</label>
          <input v-model="passwordForm.currentPassword" type="password" required autocomplete="current-password" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("settings.newPassword") }}</label>
          <input v-model="passwordForm.newPassword" type="password" required autocomplete="new-password" class="input-field" />
        </div>
        <p v-if="passwordError" class="text-sm text-danger">{{ passwordError }}</p>
        <button :disabled="changingPassword" class="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition">
          {{ changingPassword ? t("settings.updating") : t("settings.changePassword") }}
        </button>
      </form>
    </section>

    <!-- Subscription -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.subscription") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {{ t("settings.currentPlan") }}: <span class="font-semibold capitalize text-slate-700 dark:text-slate-200">{{ auth.user?.plan }}</span>
        <span v-if="sub?.isStudent" class="badge badge-primary ml-1.5">{{ t("settings.billing.student") }}</span>
        <span v-if="sub?.billingInterval" class="text-slate-400"> · {{ t(`settings.billing.interval.${sub.billingInterval}`) }}</span>
      </p>

      <p v-if="statusLine" class="text-sm mb-3" :class="sub?.subscriptionStatus === 'past_due' ? 'text-danger' : 'text-slate-600 dark:text-slate-300'">
        {{ statusLine }}
      </p>
      <p v-if="sub?.cancelAtPeriodEnd && sub?.currentPeriodEnd" class="text-sm text-warning mb-3">
        {{ t("settings.billing.cancelsOn", { date: formatDate(sub.currentPeriodEnd) }) }}
      </p>
      <div v-if="sub?.inGracePeriod" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5 mb-4">
        {{ t("settings.billing.gracePeriod", { date: formatDate(sub.gracePeriodEndsAt) }) }}
      </div>

      <div class="grid sm:grid-cols-2 gap-3 mb-4" v-if="auth.limits">
        <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("settings.studyPackages") }}</p>
          <p class="font-semibold text-slate-800 dark:text-slate-100">{{ auth.usage?.packages ?? 0 }} / {{ auth.limits.maxPackages ?? "∞" }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("settings.filesPerPackage") }}</p>
          <p class="font-semibold text-slate-800 dark:text-slate-100">{{ auth.limits.maxFilesPerPackage }}</p>
        </div>
        <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("settings.maxFileSize") }}</p>
          <p class="font-semibold text-slate-800 dark:text-slate-100">{{ auth.limits.maxFileSizeMB }} MB</p>
        </div>
        <div class="rounded-xl bg-slate-50 dark:bg-white/5 px-4 py-3">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("settings.aiTutorMessages") }}</p>
          <p class="font-semibold text-slate-800 dark:text-slate-100">{{ auth.limits.maxChatMessagesPerPackage ?? "∞" }}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 mb-5">
        <button v-if="auth.user?.plan === 'free'" class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition" @click="upgrade.show()">
          <SparklesIcon class="w-4 h-4" /> {{ t("common.upgradeToPro") }}
        </button>
        <button
          v-if="sub?.hasBillingAccount"
          :disabled="openingPortal"
          class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-4 py-2 text-sm font-semibold hover:border-slate-300 disabled:opacity-40 transition"
          @click="doManageBilling"
        >
          <ArrowPathIcon v-if="openingPortal" class="w-4 h-4 animate-spin" />
          {{ openingPortal ? t("settings.upgrading") : t("settings.manageBilling") }}
        </button>
      </div>

      <!-- Billing history -->
      <div v-if="sub?.hasBillingAccount">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{{ t("settings.billing.history") }}</h4>
        <p v-if="billing.invoices.length === 0" class="text-sm text-slate-400">{{ t("settings.billing.historyEmpty") }}</p>
        <ul v-else class="flex flex-col gap-1.5">
          <li
            v-for="inv in billing.invoices"
            :key="inv._id"
            class="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm"
          >
            <span class="text-slate-600 dark:text-slate-300">{{ formatDate(inv.createdAt) }}</span>
            <span class="font-medium text-slate-800 dark:text-slate-100">{{ (inv.amountPaid / 100).toFixed(2) }} {{ inv.currency?.toUpperCase() }}</span>
            <span
              class="badge"
              :class="inv.status === 'paid' ? 'badge-success' : inv.status === 'open' ? 'badge-warning' : 'badge-danger'"
            >{{ inv.status }}</span>
            <a v-if="inv.invoicePdfUrl" :href="inv.invoicePdfUrl" target="_blank" rel="noopener" class="text-primary hover:underline font-medium">{{ t("settings.billing.download") }}</a>
          </li>
        </ul>
      </div>
    </section>

    <!-- Support -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.support") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.supportDescription") }}</p>
      <RouterLink to="/settings/support" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition">
        {{ t("settings.openSupport") }}
      </RouterLink>
    </section>

    <!-- Appearance -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.appearance") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.appearanceDescription") }}</p>
      <div class="flex gap-2">
        <button
          class="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="!theme.dark ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="theme.apply(false)"
        >
          <SunIcon class="w-5 h-5" /> {{ t("common.light") }}
        </button>
        <button
          class="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="theme.dark ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="theme.apply(true)"
        >
          <MoonIcon class="w-5 h-5" /> {{ t("common.dark") }}
        </button>
      </div>
    </section>

    <!-- Language -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.language") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.languageDescription") }}</p>
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="lang === 'en' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="locale.set('en')"
        >
          English
        </button>
        <button
          class="flex-1 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="lang === 'mk' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="locale.set('mk')"
        >
          Македонски
        </button>
      </div>
    </section>

    <!-- Danger zone -->
    <section class="rounded-2xl border-2 border-danger/30 bg-danger/5 p-5">
      <h3 class="font-display font-bold text-danger mb-1">{{ t("settings.dangerZone") }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">{{ t("settings.dangerZoneDescription") }}</p>
      <button class="inline-flex items-center gap-2 rounded-xl border-2 border-danger/40 text-danger px-4 py-2 text-sm font-semibold hover:bg-danger/10 transition" @click="confirmDeleteOpen = true">
        <TrashIcon class="w-4 h-4" /> {{ t("settings.deleteAccount") }}
      </button>
    </section>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="confirmDeleteOpen" class="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="confirmDeleteOpen = false"></div>
          <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">{{ t("settings.deleteAccountConfirmTitle") }}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">{{ t("settings.deleteAccountConfirmBody") }}</p>
            <input v-model="deletePassword" type="password" class="input-field mb-3" :placeholder="t('settings.passwordPlaceholder')" />
            <p v-if="deleteError" class="text-sm text-danger mb-3">{{ deleteError }}</p>
            <div class="flex justify-end gap-2">
              <button class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5" @click="confirmDeleteOpen = false">{{ t("common.cancel") }}</button>
              <button :disabled="deleting" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-danger hover:bg-red-600 disabled:opacity-40 transition" @click="doDeleteAccount">
                {{ deleting ? t("settings.deleting") : t("settings.deleteAccount") }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { SunIcon, MoonIcon, SparklesIcon, TrashIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useThemeStore } from "../stores/theme.js";
import { useAuthStore } from "../stores/auth.js";
import { useBillingStore } from "../stores/billing.js";
import { useUpgradeStore } from "../stores/upgrade.js";
import { useLocaleStore } from "../stores/locale.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import { reportApiError } from "../composables/useApiError.js";
import { useModalBehavior } from "../composables/useModalBehavior.js";
import { api } from "../services/api.js";

const theme = useThemeStore();
const auth = useAuthStore();
const billing = useBillingStore();
const upgrade = useUpgradeStore();
const locale = useLocaleStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
const { t, lang } = useI18n();

const profileForm = reactive({ name: auth.user?.name || "" });
const savingProfile = ref(false);
async function saveProfile() {
  savingProfile.value = true;
  try {
    await auth.updateProfile({ name: profileForm.name });
    toast.success(t("toasts.profileUpdated"));
  } catch (e) {
    reportApiError(e);
  } finally {
    savingProfile.value = false;
  }
}

const resending = ref(false);
async function resendVerification() {
  resending.value = true;
  try {
    const res = await api.resendVerification();
    toast.success(res.devVerificationLink ? t("toasts.verificationLinkGenerated") : t("toasts.verificationSent"));
  } catch (e) {
    reportApiError(e);
  } finally {
    resending.value = false;
  }
}

const passwordForm = reactive({ currentPassword: "", newPassword: "" });
const passwordError = ref("");
const changingPassword = ref(false);
async function changePassword() {
  passwordError.value = "";
  changingPassword.value = true;
  try {
    await api.changePassword(passwordForm);
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    toast.success(t("toasts.passwordChanged"));
  } catch (e) {
    passwordError.value = e.message;
  } finally {
    changingPassword.value = false;
  }
}

const sub = computed(() => billing.subscription);
const statusLine = computed(() => {
  const status = sub.value?.subscriptionStatus;
  if (!status) return "";
  const date = status === "trialing" ? sub.value.trialEndsAt : sub.value.currentPeriodEnd;
  return t(`settings.billing.status.${status}`, { date: date ? formatDate(date) : "" });
});
function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

const openingPortal = ref(false);
async function doManageBilling() {
  openingPortal.value = true;
  try {
    await billing.openBillingPortal();
    // openBillingPortal redirects the browser away on success — loading
    // stays true through the navigation.
  } catch (e) {
    reportApiError(e);
    openingPortal.value = false;
  }
}

onMounted(async () => {
  try {
    await billing.fetchSubscription();
    if (billing.subscription?.hasBillingAccount) await billing.fetchInvoices();
  } catch (e) {
    reportApiError(e);
  }

  // Returning from Stripe Checkout: refresh auth state (the webhook that
  // actually activates the subscription may land a moment before or after
  // this redirect, so re-fetching /auth/me picks up whichever already
  // happened rather than trusting the query param alone).
  const checkoutResult = route.query.checkout;
  if (checkoutResult === "success") {
    await auth.fetchMe();
    await billing.fetchSubscription();
    toast.success(t("toasts.upgradedToPro"));
    router.replace({ query: {} });
  } else if (checkoutResult === "cancel") {
    toast.error(t("toasts.checkoutCanceled"));
    router.replace({ query: {} });
  }
});

const confirmDeleteOpen = ref(false);
useModalBehavior(confirmDeleteOpen, () => (confirmDeleteOpen.value = false));
const deletePassword = ref("");
const deleteError = ref("");
const deleting = ref(false);
async function doDeleteAccount() {
  deleteError.value = "";
  deleting.value = true;
  try {
    await auth.deleteAccount(deletePassword.value);
    toast.success(t("toasts.accountDeleted"));
    router.push("/");
  } catch (e) {
    deleteError.value = e.message;
  } finally {
    deleting.value = false;
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
