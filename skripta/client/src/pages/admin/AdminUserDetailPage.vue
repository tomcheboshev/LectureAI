<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <RouterLink to="/admin/users" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4">
      <ArrowLeftIcon class="w-4 h-4" /> {{ t("admin.users.title") }}
    </RouterLink>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="detail">
      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 class="font-display font-extrabold text-xl text-slate-900 dark:text-white">{{ detail.user.name }}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ detail.user.email }}</p>
            <div class="flex gap-1.5 mt-2">
              <span class="badge" :class="detail.user.plan === 'free' ? 'badge-primary' : 'badge-success'">{{ detail.user.plan }}</span>
              <span class="badge" :class="detail.user.banned ? 'badge-danger' : 'badge-success'">{{ detail.user.banned ? t("admin.users.filterBanned") : t("admin.users.filterActive") }}</span>
              <span v-if="detail.user.role === 'admin'" class="badge badge-primary">{{ t("admin.nav.badge") }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              v-if="!detail.user.banned"
              class="px-4 py-2 rounded-lg text-sm font-semibold border border-danger/30 text-danger hover:bg-danger/5 transition"
              @click="banOpen = true"
            >
              {{ t("admin.users.ban") }}
            </button>
            <button v-else class="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doUnban">
              {{ t("admin.users.unban") }}
            </button>
            <button class="px-4 py-2 rounded-lg text-sm font-semibold bg-danger text-white hover:bg-red-600 transition" @click="deleteOpen = true">
              {{ t("common.delete") }}
            </button>
          </div>
        </div>
        <p v-if="detail.user.banned && detail.user.banReason" class="text-xs text-danger mt-3">{{ t("admin.users.banReasonLabel") }}: {{ detail.user.banReason }}</p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard :icon="DocumentTextIcon" :value="detail.usage.packages" :label="t('admin.users.stats.packages')" />
        <StatsCard :icon="CircleStackIcon" :value="formatChars(detail.usage.storageChars)" :label="t('admin.users.stats.storage')" />
        <StatsCard :icon="SparklesIcon" :value="detail.usage.aiCalls" :label="t('admin.users.stats.aiCalls')" />
        <StatsCard :icon="CurrencyDollarIcon" :value="`$${detail.usage.aiEstimatedCostUsd.toFixed(3)}`" :label="t('admin.users.stats.aiCost')" />
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 mb-6">
        <h2 class="font-display font-bold text-base text-slate-900 dark:text-white mb-1">{{ t("admin.users.overrideTitle") }}</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">{{ t("admin.users.overrideWarning") }}</p>
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.users.plan") }}</label>
            <select v-model="overridePlan" class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <button :disabled="overriding" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition" @click="doOverride">
            {{ overriding ? t("admin.users.saving") : t("common.save") }}
          </button>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
        <h2 class="font-display font-bold text-base text-slate-900 dark:text-white mb-4">{{ t("admin.users.invoices") }}</h2>
        <p v-if="!detail.invoices.length" class="text-sm text-slate-400">{{ t("admin.users.noInvoices") }}</p>
        <ul v-else class="divide-y divide-slate-100 dark:divide-border-dark">
          <li v-for="inv in detail.invoices" :key="inv._id" class="flex items-center justify-between py-2.5 text-sm">
            <span class="text-slate-500 dark:text-slate-400">{{ formatDate(inv.createdAt) }}</span>
            <span class="font-medium text-slate-900 dark:text-white">${{ (inv.amountPaid / 100).toFixed(2) }}</span>
            <span class="badge" :class="inv.status === 'paid' ? 'badge-success' : 'badge-warning'">{{ inv.status }}</span>
          </li>
        </ul>
      </div>
    </template>

    <Modal :open="banOpen" :title="t('admin.users.banConfirmTitle')" :confirm-label="t('admin.users.ban')" @close="banOpen = false" @confirm="doBan">
      <div class="mb-2">{{ t("admin.users.banConfirmBody") }}</div>
      <input v-model="banReason" type="text" :placeholder="t('admin.users.banReasonPlaceholder')" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
    </Modal>

    <Modal :open="deleteOpen" :title="t('admin.users.deleteConfirmTitle')" :confirm-label="t('common.delete')" @close="deleteOpen = false" @confirm="doDelete">
      {{ t("admin.users.deleteConfirmBody") }}
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { ArrowLeftIcon, DocumentTextIcon, CircleStackIcon, SparklesIcon, CurrencyDollarIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import { useToastStore } from "../../stores/toast.js";
import StatsCard from "../../components/StatsCard.vue";
import Modal from "../../components/ui/Modal.vue";

const { t, lang } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const detail = ref(null);
const loading = ref(false);
const banOpen = ref(false);
const banReason = ref("");
const deleteOpen = ref(false);
const overridePlan = ref("free");
const overriding = ref(false);

async function load() {
  loading.value = true;
  try {
    detail.value = await adminApi.getUser(route.params.id);
    overridePlan.value = detail.value.user.plan;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

async function doBan() {
  banOpen.value = false;
  try {
    await adminApi.banUser(route.params.id, banReason.value);
    banReason.value = "";
    toast.success(t("admin.users.banned"));
    await load();
  } catch (err) {
    reportApiError(err);
  }
}

async function doUnban() {
  try {
    await adminApi.unbanUser(route.params.id);
    toast.success(t("admin.users.unbanned"));
    await load();
  } catch (err) {
    reportApiError(err);
  }
}

async function doDelete() {
  deleteOpen.value = false;
  try {
    await adminApi.deleteUser(route.params.id);
    toast.success(t("admin.users.deleted"));
    router.push("/admin/users");
  } catch (err) {
    reportApiError(err);
  }
}

async function doOverride() {
  overriding.value = true;
  try {
    await adminApi.overrideSubscription(route.params.id, { plan: overridePlan.value });
    toast.success(t("admin.users.overrideSaved"));
    await load();
  } catch (err) {
    reportApiError(err);
  } finally {
    overriding.value = false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

function formatChars(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

onMounted(load);
</script>
