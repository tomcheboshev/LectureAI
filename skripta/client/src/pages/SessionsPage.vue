<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
    <RouterLink to="/settings" class="text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition mb-3 inline-block">{{ t("common.back") }}</RouterLink>
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("settings.sessions.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("settings.sessions.subtitle") }}</p>

    <div v-if="loading" class="text-center py-10 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else>
      <ul class="flex flex-col gap-2.5 mb-6">
        <li
          v-for="session in sessions"
          :key="session.sessionId"
          class="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 flex items-start justify-between gap-3"
        >
          <div class="flex items-start gap-3 min-w-0">
            <span class="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 shrink-0">
              <DevicePhoneMobileIcon v-if="isMobile(session)" class="w-5 h-5" />
              <ComputerDesktopIcon v-else class="w-5 h-5" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                {{ session.browser || t("settings.sessions.unknownBrowser") }} · {{ session.os || t("settings.sessions.unknownOs") }}
                <span v-if="session.isCurrent" class="badge badge-success">{{ t("settings.sessions.thisDevice") }}</span>
              </p>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ t("settings.sessions.lastActive", { time: formatRelative(session.lastActiveAt) }) }}
                <span v-if="session.ip"> · {{ session.ip }}</span>
              </p>
            </div>
          </div>
          <button
            v-if="!session.isCurrent"
            :disabled="revokingId === session.sessionId"
            class="shrink-0 text-xs font-semibold text-danger hover:underline disabled:opacity-40"
            @click="doRevoke(session.sessionId)"
          >
            {{ revokingId === session.sessionId ? t("settings.sessions.revoking") : t("settings.sessions.revoke") }}
          </button>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="sessions.length > 1"
          :disabled="revokingOthers"
          class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 dark:border-border-dark px-4 py-2 text-sm font-semibold hover:border-slate-300 disabled:opacity-40 transition"
          @click="doRevokeOthers"
        >
          <ArrowPathIcon v-if="revokingOthers" class="w-4 h-4 animate-spin" />
          {{ revokingOthers ? t("settings.sessions.revoking") : t("settings.sessions.revokeOthers") }}
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-xl border-2 border-danger/30 text-danger px-4 py-2 text-sm font-semibold hover:bg-danger/10 transition"
          @click="confirmRevokeAllOpen = true"
        >
          {{ t("settings.sessions.revokeAll") }}
        </button>
      </div>
    </template>

    <Modal
      :open="confirmRevokeAllOpen"
      :title="t('settings.sessions.revokeAllConfirmTitle')"
      :confirm-label="revokingAll ? t('settings.sessions.revoking') : t('settings.sessions.revokeAll')"
      :loading="revokingAll"
      @close="confirmRevokeAllOpen = false"
      @confirm="doRevokeAll"
    >
      {{ t("settings.sessions.revokeAllConfirmBody") }}
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ArrowPathIcon, DevicePhoneMobileIcon, ComputerDesktopIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import { reportApiError } from "../composables/useApiError.js";
import Modal from "../components/ui/Modal.vue";

const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();
const { t, lang } = useI18n();

const sessions = ref([]);
const loading = ref(false);
const revokingId = ref(null);
const revokingOthers = ref(false);
const confirmRevokeAllOpen = ref(false);
const revokingAll = ref(false);

function isMobile(session) {
  return /iPhone|iPad|Android|Mobile/i.test(`${session.device || ""} ${session.os || ""}`);
}

function formatRelative(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return t("settings.sessions.justNow");
  if (diffMin < 60) return t("settings.sessions.minutesAgo", { count: diffMin });
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("settings.sessions.hoursAgo", { count: diffHr });
  return new Date(dateStr).toLocaleDateString(lang.value, { day: "numeric", month: "short" });
}

async function load() {
  loading.value = true;
  try {
    const res = await api.listSessions();
    sessions.value = res.sessions;
  } catch (e) {
    reportApiError(e);
  } finally {
    loading.value = false;
  }
}

async function doRevoke(sessionId) {
  revokingId.value = sessionId;
  try {
    await api.revokeSession(sessionId);
    sessions.value = sessions.value.filter((s) => s.sessionId !== sessionId);
  } catch (e) {
    reportApiError(e);
  } finally {
    revokingId.value = null;
  }
}

async function doRevokeOthers() {
  revokingOthers.value = true;
  try {
    await api.revokeOtherSessions();
    toast.success(t("settings.sessions.revokedOthersToast"));
    await load();
  } catch (e) {
    reportApiError(e);
  } finally {
    revokingOthers.value = false;
  }
}

async function doRevokeAll() {
  revokingAll.value = true;
  try {
    await api.revokeAllSessions();
  } catch (e) {
    reportApiError(e);
    return;
  } finally {
    revokingAll.value = false;
    confirmRevokeAllOpen.value = false;
  }
  // revoke-all clears this browser's own session too — mirror what
  // logout() does client-side rather than calling api.logout() again
  // (which would just 401 against an already-cleared cookie).
  auth.clearSession();
  router.push("/login");
}

onMounted(load);
</script>
