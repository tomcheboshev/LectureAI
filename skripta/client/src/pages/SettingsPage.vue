<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-1">{{ t("nav.settings") }}</h1>
    <p class="text-slate-500 dark:text-slate-400 mb-8">{{ t("settings.pageSubtitle") }}</p>

    <!-- Profile -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.profile") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.profileDescription") }}</p>

      <div class="flex items-center gap-4 mb-5">
        <span class="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary font-display font-bold text-xl overflow-hidden shrink-0">
          <img v-if="auth.user?.pictureUrl" :src="auth.user.pictureUrl" alt="" class="w-full h-full object-cover" />
          <span v-else>{{ avatarInitials }}</span>
        </span>
        <div>
          <button type="button" :disabled="uploadingAvatar" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition" @click="avatarInput?.click()">
            <ArrowPathIcon v-if="uploadingAvatar" class="w-4 h-4 animate-spin" />
            {{ uploadingAvatar ? t("settings.avatar.uploading") : t("settings.avatar.upload") }}
          </button>
          <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
          <p class="text-xs text-slate-400 mt-1.5">{{ t("settings.avatar.hint") }}</p>
        </div>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="saveProfile">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.firstName") }}</label>
            <input v-model="profileForm.firstName" maxlength="50" required class="input-field" />
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.lastName") }}</label>
            <input v-model="profileForm.lastName" maxlength="50" required class="input-field" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.email") }}</label>
          <div class="flex items-center gap-2">
            <input :value="auth.user?.email" disabled class="input-field opacity-60 cursor-not-allowed" />
            <span v-if="auth.user?.emailVerified" class="badge badge-success shrink-0">{{ t("settings.verified") }}</span>
            <button v-else type="button" :disabled="resending || resendCooldown > 0" class="badge badge-warning shrink-0 hover:bg-warning/20 disabled:opacity-40 transition" @click="resendVerification">
              {{ resending ? t("settings.sending") : resendCooldown > 0 ? t("settings.resendCooldown", { seconds: resendCooldown }) : t("settings.verify") }}
            </button>
          </div>
        </div>
        <button :disabled="savingProfile" class="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition">
          {{ savingProfile ? t("settings.saving") : t("common.save") }}
        </button>
      </form>
    </section>

    <!-- Change email -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.emailChange.title") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.emailChange.description") }}</p>

      <div v-if="emailChangeSent" class="rounded-xl border border-success/30 bg-success/5 text-sm text-slate-600 dark:text-slate-300 px-4 py-3">
        {{ t("settings.emailChange.sentBody", { email: emailForm.newEmail }) }}
        <a v-if="emailChangeDevLink" :href="emailChangeDevLink" class="block text-xs font-mono break-all text-primary mt-2 hover:underline">{{ emailChangeDevLink }}</a>
      </div>
      <form v-else class="flex flex-col gap-4" @submit.prevent="requestEmailChange">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("settings.emailChange.newEmailLabel") }}</label>
          <input v-model="emailForm.newEmail" type="email" required class="input-field" :placeholder="t('common.emailPlaceholder')" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("settings.emailChange.currentPasswordLabel") }}</label>
          <input v-model="emailForm.currentPassword" type="password" required autocomplete="current-password" class="input-field" />
        </div>
        <p v-if="emailChangeError" class="text-sm text-danger">{{ emailChangeError }}</p>
        <button :disabled="requestingEmailChange" class="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40 transition">
          {{ requestingEmailChange ? t("settings.sending") : t("settings.emailChange.submit") }}
        </button>
      </form>
    </section>

    <!-- Connected accounts -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.connectedAccounts.title") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.connectedAccounts.description") }}</p>
      <ul class="flex flex-col gap-2.5">
        <li v-for="provider in ['google', 'github']" :key="provider" class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-border-dark px-4 py-3">
          <div>
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{{ provider }}</p>
            <p class="text-xs text-slate-400">{{ connectedAccountEmail(provider) || t("settings.connectedAccounts.notConnected") }}</p>
          </div>
          <button
            v-if="connectedAccountEmail(provider)"
            :disabled="disconnectingProvider === provider"
            class="text-xs font-semibold text-danger hover:underline disabled:opacity-40"
            @click="confirmDisconnect(provider)"
          >
            {{ disconnectingProvider === provider ? t("settings.connectedAccounts.disconnecting") : t("settings.connectedAccounts.disconnect") }}
          </button>
          <a v-else :href="`/api/auth/oauth/${provider}?intent=link`" class="text-xs font-semibold text-primary hover:underline">
            {{ t("settings.connectedAccounts.connect") }}
          </a>
        </li>
      </ul>
    </section>

    <Modal
      :open="Boolean(disconnectTarget)"
      :title="t('settings.connectedAccounts.disconnectConfirmTitle')"
      :confirm-label="t('settings.connectedAccounts.disconnect')"
      @close="disconnectTarget = null"
      @confirm="doDisconnect"
    >
      {{ t("settings.connectedAccounts.disconnectConfirmBody", { provider: disconnectTarget }) }}
    </Modal>

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

      <!-- Grace period: last renewal failed, still has a few days of access -->
      <div v-if="sub?.inGracePeriod" class="rounded-xl border border-danger/30 bg-danger/5 p-4 mb-4">
        <p class="text-sm text-danger mb-3">{{ t("settings.billing.gracePeriod", { date: formatDate(sub.gracePeriodEndsAt) }) }}</p>
        <div class="flex flex-wrap gap-2">
          <button :disabled="openingPortal" class="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40 transition" @click="doManageBilling">
            {{ t("settings.billing.updatePaymentMethod") }}
          </button>
          <button v-if="retryableInvoiceId" :disabled="retryingInvoice" class="inline-flex items-center gap-1.5 rounded-lg border-2 border-danger/40 text-danger px-3.5 py-1.5 text-xs font-semibold hover:bg-danger/10 disabled:opacity-40 transition" @click="doRetryInvoice">
            <ArrowPathIcon v-if="retryingInvoice" class="w-3.5 h-3.5 animate-spin" /> {{ retryingInvoice ? t("settings.billing.retrying") : t("settings.billing.retryPayment") }}
          </button>
        </div>
      </div>

      <!-- Expired: previously subscribed, now auto-downgraded to free -->
      <div v-else-if="isExpired" class="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 p-4 mb-4">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{{ t("settings.billing.expiredBanner.title") }}</p>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition" @click="upgrade.show()">
            {{ t("settings.billing.expiredBanner.renew") }}
          </button>
          <RouterLink to="/pricing" class="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-200 dark:border-border-dark px-3.5 py-1.5 text-xs font-semibold hover:border-slate-300 transition">
            {{ t("settings.billing.expiredBanner.comparePlans") }}
          </RouterLink>
        </div>
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
        <button
          v-if="sub?.cancelAtPeriodEnd"
          :disabled="resumingSubscription"
          class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-4 py-2 text-sm font-semibold hover:border-slate-300 disabled:opacity-40 transition"
          @click="doResume"
        >
          <ArrowPathIcon v-if="resumingSubscription" class="w-4 h-4 animate-spin" />
          {{ resumingSubscription ? t("settings.billing.resuming") : t("settings.billing.resumeSubscription") }}
        </button>
        <button
          v-else-if="auth.user?.plan !== 'free' && sub?.subscriptionStatus !== 'canceled'"
          class="inline-flex items-center gap-2 rounded-xl border-2 border-danger/30 text-danger px-4 py-2 text-sm font-semibold hover:bg-danger/10 transition"
          @click="cancelModalOpen = true"
        >
          {{ t("settings.billing.cancelSubscription") }}
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

    <!-- Refer a friend -->
    <section v-if="referral" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.referral.title") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.referral.description") }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <code class="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm font-mono font-semibold text-slate-800 dark:text-slate-100">{{ referral.code }}</code>
        <button class="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-200 dark:border-border-dark px-3.5 py-1.5 text-xs font-semibold hover:border-slate-300 transition" @click="copyReferralLink">
          {{ referralCopied ? t("settings.referral.copied") : t("settings.referral.copyLink") }}
        </button>
      </div>
      <p v-if="referral.redemptions > 0" class="text-xs text-slate-400 mt-2.5">{{ t("settings.referral.redemptions", { count: referral.redemptions }) }}</p>
    </section>

    <!-- Support -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.support") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.supportDescription") }}</p>
      <RouterLink to="/settings/support" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition">
        {{ t("settings.openSupport") }}
      </RouterLink>
    </section>

    <!-- Sessions -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.sessionsSection") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.sessionsSectionDescription") }}</p>
      <RouterLink to="/settings/sessions" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition">
        {{ t("settings.openSessions") }}
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

    <!-- Export data -->
    <section class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">{{ t("settings.exportData.title") }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">{{ t("settings.exportData.description") }}</p>
      <button :disabled="exportingData" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition" @click="doExportData">
        <ArrowPathIcon v-if="exportingData" class="w-4 h-4 animate-spin" />
        {{ exportingData ? t("settings.exportData.exporting") : t("settings.exportData.download") }}
      </button>
    </section>

    <!-- Danger zone -->
    <section class="rounded-2xl border-2 border-danger/30 bg-danger/5 p-5">
      <h3 class="font-display font-bold text-danger mb-1">{{ t("settings.dangerZone") }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">{{ t("settings.dangerZoneDescription") }}</p>
      <button class="inline-flex items-center gap-2 rounded-xl border-2 border-danger/40 text-danger px-4 py-2 text-sm font-semibold hover:bg-danger/10 transition" @click="confirmDeleteOpen = true">
        <TrashIcon class="w-4 h-4" /> {{ t("settings.deleteAccount") }}
      </button>
    </section>

    <Modal
      :open="confirmDeleteOpen"
      :title="t('settings.deleteAccountConfirmTitle')"
      :confirm-label="deleting ? t('settings.deleting') : t('settings.deleteAccount')"
      @close="confirmDeleteOpen = false"
      @confirm="doDeleteAccount"
    >
      <p class="mb-3">{{ t("settings.deleteAccountConfirmBody") }}</p>
      <input v-model="deletePassword" type="password" class="input-field mb-2" :placeholder="t('settings.passwordPlaceholder')" />
      <p v-if="deleteError" class="text-sm text-danger">{{ deleteError }}</p>
    </Modal>

    <CancelSubscriptionModal :open="cancelModalOpen" :period-end-date="sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : ''" @close="cancelModalOpen = false" />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { SunIcon, MoonIcon, SparklesIcon, TrashIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useThemeStore } from "../stores/theme.js";
import { useAuthStore } from "../stores/auth.js";
import { useBillingStore } from "../stores/billing.js";
import { useUpgradeStore } from "../stores/upgrade.js";
import { useLocaleStore } from "../stores/locale.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import { reportApiError } from "../composables/useApiError.js";
import { api } from "../services/api.js";
import CancelSubscriptionModal from "../components/CancelSubscriptionModal.vue";
import Modal from "../components/ui/Modal.vue";

const theme = useThemeStore();
const auth = useAuthStore();
const billing = useBillingStore();
const upgrade = useUpgradeStore();
const locale = useLocaleStore();
const toast = useToastStore();
const router = useRouter();
const { t, lang } = useI18n();

const profileForm = reactive({ firstName: auth.user?.firstName || "", lastName: auth.user?.lastName || "" });
const savingProfile = ref(false);
async function saveProfile() {
  savingProfile.value = true;
  try {
    await auth.updateProfile({ firstName: profileForm.firstName, lastName: profileForm.lastName });
    toast.success(t("toasts.profileUpdated"));
  } catch (e) {
    reportApiError(e);
  } finally {
    savingProfile.value = false;
  }
}

const avatarInitials = computed(() => `${auth.user?.firstName?.[0] || ""}${auth.user?.lastName?.[0] || ""}`.toUpperCase() || "?");
const avatarInput = ref(null);
const uploadingAvatar = ref(false);
async function onAvatarSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = ""; // allows re-selecting the same file later
  if (!file) return;
  uploadingAvatar.value = true;
  try {
    await auth.uploadAvatar(file);
    toast.success(t("settings.avatar.uploaded"));
  } catch (err) {
    reportApiError(err);
  } finally {
    uploadingAvatar.value = false;
  }
}

const emailForm = reactive({ newEmail: "", currentPassword: "" });
const requestingEmailChange = ref(false);
const emailChangeSent = ref(false);
const emailChangeError = ref("");
const emailChangeDevLink = ref("");
async function requestEmailChange() {
  emailChangeError.value = "";
  requestingEmailChange.value = true;
  try {
    const res = await api.changeEmail({ newEmail: emailForm.newEmail, currentPassword: emailForm.currentPassword });
    emailChangeSent.value = true;
    emailChangeDevLink.value = res.devEmailChangeLink || "";
  } catch (e) {
    emailChangeError.value = e.message;
  } finally {
    requestingEmailChange.value = false;
  }
}

const connectedAccounts = ref([]);
function connectedAccountEmail(provider) {
  return connectedAccounts.value.find((a) => a.provider === provider)?.email || null;
}
async function loadConnectedAccounts() {
  try {
    const res = await api.getConnectedAccounts();
    connectedAccounts.value = res.connectedAccounts;
  } catch (e) {
    reportApiError(e);
  }
}
const disconnectTarget = ref(null);
const disconnectingProvider = ref(null);
function confirmDisconnect(provider) {
  disconnectTarget.value = provider;
}
async function doDisconnect() {
  const provider = disconnectTarget.value;
  disconnectTarget.value = null;
  disconnectingProvider.value = provider;
  try {
    const res = await api.disconnectProvider(provider);
    connectedAccounts.value = res.connectedAccounts;
    toast.success(t("settings.connectedAccounts.disconnectedToast"));
  } catch (e) {
    reportApiError(e);
  } finally {
    disconnectingProvider.value = null;
  }
}

const exportingData = ref(false);
async function doExportData() {
  exportingData.value = true;
  try {
    await api.exportData();
  } catch (e) {
    reportApiError(e);
  } finally {
    exportingData.value = false;
  }
}

const resending = ref(false);
const resendCooldown = ref(0);
let resendCooldownTimer = null;
function startResendCooldown(seconds) {
  clearInterval(resendCooldownTimer);
  resendCooldown.value = seconds;
  resendCooldownTimer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0) clearInterval(resendCooldownTimer);
  }, 1000);
}
async function resendVerification() {
  resending.value = true;
  try {
    const res = await api.resendVerification();
    toast.success(res.devVerificationLink ? t("toasts.verificationLinkGenerated") : t("toasts.verificationSent"));
    startResendCooldown(60);
  } catch (e) {
    if (e.status === 429 && e.retryAfterSeconds) startResendCooldown(e.retryAfterSeconds);
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

const referral = ref(null);
const referralCopied = ref(false);
async function copyReferralLink() {
  try {
    await navigator.clipboard.writeText(referral.value.shareUrl);
    referralCopied.value = true;
    setTimeout(() => (referralCopied.value = false), 2000);
  } catch {
    // Clipboard access can be denied by the browser — not worth surfacing
    // as an error toast, the code is still visible to copy by hand.
  }
}

onMounted(async () => {
  try {
    await billing.fetchSubscription();
    if (billing.subscription?.hasBillingAccount) await billing.fetchInvoices();
  } catch (e) {
    reportApiError(e);
  }
  try {
    referral.value = await api.getReferral();
  } catch (e) {
    reportApiError(e);
  }
  await loadConnectedAccounts();
});

// A subscription that ran its full course (auto-downgraded to free by
// syncEffectivePlan() once grace period lapsed, or fully canceled) is
// distinct from a user who never subscribed at all — hasBillingAccount is
// what tells them apart, since a never-subscribed user has no Stripe
// customer to have "expired".
const isExpired = computed(() => auth.user?.plan === "free" && sub.value?.hasBillingAccount && sub.value?.subscriptionStatus === "canceled");

const cancelModalOpen = ref(false);
const resumingSubscription = ref(false);
async function doResume() {
  resumingSubscription.value = true;
  try {
    await billing.resume();
    toast.success(t("subscription.resumed.title"));
  } catch (e) {
    reportApiError(e);
  } finally {
    resumingSubscription.value = false;
  }
}

const retryableInvoiceId = computed(() => billing.invoices.find((inv) => inv.status === "open")?.stripeInvoiceId || null);
const retryingInvoice = ref(false);
async function doRetryInvoice() {
  retryingInvoice.value = true;
  try {
    await api.retryInvoice(retryableInvoiceId.value);
    await Promise.all([billing.fetchSubscription(), billing.fetchInvoices()]);
    toast.success(t("payment.failed.retrySuccess"));
  } catch (e) {
    reportApiError(e);
  } finally {
    retryingInvoice.value = false;
  }
}

const confirmDeleteOpen = ref(false);
const deletePassword = ref("");
const deleteError = ref("");
const deleting = ref(false);
async function doDeleteAccount() {
  deleteError.value = "";
  deleting.value = true;
  try {
    await auth.deleteAccount(deletePassword.value);
    confirmDeleteOpen.value = false;
    deletePassword.value = "";
    // Session stays alive (30-day soft-delete, see the reactivate banner in
    // AppShell.vue) — no navigation away, just confirm what happened.
    toast.success(t("toasts.accountDeletionScheduled", { date: formatDate(auth.user.deletionScheduledAt) }));
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
