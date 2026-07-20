<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("support.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("support.subtitle") }}</p>

    <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 mb-6">
      <h2 class="font-display font-bold text-base text-slate-900 dark:text-white mb-4">{{ t("support.newTicket") }}</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("support.subject") }}</label>
          <input v-model="subject" type="text" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("support.body") }}</label>
          <textarea v-model="body" rows="4" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm"></textarea>
        </div>
        <button :disabled="submitting" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition" @click="submit">
          {{ submitting ? t("support.submitting") : t("support.submit") }}
        </button>
      </div>
    </div>

    <h2 class="font-display font-bold text-base text-slate-900 dark:text-white mb-3">{{ t("support.yourTickets") }}</h2>
    <div v-if="loading" class="text-center py-10 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>
    <p v-else-if="!tickets.length" class="text-sm text-slate-400">{{ t("support.noTickets") }}</p>
    <ul v-else class="space-y-2">
      <li v-for="ticket in tickets" :key="ticket._id" class="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-900 dark:text-white break-words">{{ ticket.subject }}</p>
          <p class="text-xs text-slate-400">{{ formatDate(ticket.createdAt) }}</p>
        </div>
        <span class="badge shrink-0" :class="statusBadge(ticket.status)">{{ t(`support.status.${ticket.status}`) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "../services/api.js";
import { useI18n } from "../composables/useI18n.js";
import { reportApiError } from "../composables/useApiError.js";
import { useToastStore } from "../stores/toast.js";

const { t, lang } = useI18n();
const toast = useToastStore();

const subject = ref("");
const body = ref("");
const submitting = ref(false);
const tickets = ref([]);
const loading = ref(false);

function statusBadge(status) {
  if (status === "resolved" || status === "closed") return "badge-success";
  if (status === "in_progress") return "badge-warning";
  return "badge-primary";
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

async function loadTickets() {
  loading.value = true;
  try {
    const { tickets: t2 } = await api.listSupportTickets();
    tickets.value = t2;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!subject.value.trim() || !body.value.trim()) return;
  submitting.value = true;
  try {
    await api.createSupportTicket({ subject: subject.value, body: body.value });
    subject.value = "";
    body.value = "";
    toast.success(t("support.submitted"));
    await loadTickets();
  } catch (err) {
    reportApiError(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(loadTickets);
</script>
