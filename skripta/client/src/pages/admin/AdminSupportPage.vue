<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.support.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.support.subtitle") }}</p>

    <select v-model="statusFilter" class="mb-4 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2.5" @change="reload">
      <option value="">{{ t("admin.errors.allLevels") }}</option>
      <option value="open">{{ t("support.status.open") }}</option>
      <option value="in_progress">{{ t("support.status.in_progress") }}</option>
      <option value="resolved">{{ t("support.status.resolved") }}</option>
      <option value="closed">{{ t("support.status.closed") }}</option>
    </select>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>
    <EmptyState v-else-if="!tickets.length" :icon="LifebuoyIcon" :title="t('admin.support.emptyTitle')" :description="t('admin.support.emptyBody')" />

    <ul v-else class="space-y-3">
      <li v-for="ticket in tickets" :key="ticket._id" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4">
        <div class="flex items-center justify-between cursor-pointer" @click="toggle(ticket._id)">
          <div>
            <p class="text-sm font-medium text-slate-900 dark:text-white">{{ ticket.subject }}</p>
            <p class="text-xs text-slate-400">{{ ticket.owner?.name }} ({{ ticket.owner?.email }})</p>
          </div>
          <span class="badge" :class="statusBadge(ticket.status)">{{ t(`support.status.${ticket.status}`) }}</span>
        </div>

        <div v-if="expanded === ticket._id" class="mt-4 pt-4 border-t border-slate-100 dark:border-border-dark">
          <p v-if="!detail" class="text-sm text-slate-400 mb-4">{{ t("admin.users.loading") }}</p>
          <template v-else>
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 whitespace-pre-wrap">{{ detail.body }}</p>

          <div class="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.users.status") }}</label>
              <select v-model="editStatus" class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2">
                <option value="open">{{ t("support.status.open") }}</option>
                <option value="in_progress">{{ t("support.status.in_progress") }}</option>
                <option value="resolved">{{ t("support.status.resolved") }}</option>
                <option value="closed">{{ t("support.status.closed") }}</option>
              </select>
            </div>
            <button class="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition" @click="saveStatus(ticket._id)">{{ t("common.save") }}</button>
          </div>

          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{{ t("admin.support.internalNotes") }}</h3>
          <ul class="space-y-2 mb-3">
            <li v-for="(note, i) in detail?.internalNotes" :key="i" class="text-sm bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
              <span class="text-slate-700 dark:text-slate-200">{{ note.note }}</span>
              <span class="block text-xs text-slate-400 mt-0.5">{{ note.admin?.name }} · {{ formatDate(note.createdAt) }}</span>
            </li>
          </ul>
          <div class="flex gap-2">
            <input v-model="newNote" type="text" :placeholder="t('admin.support.addNotePlaceholder')" class="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
            <button class="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="addNote(ticket._id)">
              {{ t("admin.support.addNote") }}
            </button>
          </div>
          </template>
        </div>
      </li>
    </ul>

    <div v-if="total > limit" class="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
      <span>{{ t("admin.users.pageOf", { page, pages: Math.ceil(total / limit) }) }}</span>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border-dark disabled:opacity-40" :disabled="page <= 1" @click="changePage(page - 1)">
          {{ t("admin.users.prev") }}
        </button>
        <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border-dark disabled:opacity-40" :disabled="page * limit >= total" @click="changePage(page + 1)">
          {{ t("admin.users.next") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { LifebuoyIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import { useToastStore } from "../../stores/toast.js";
import EmptyState from "../../components/ui/EmptyState.vue";

const { t, lang } = useI18n();
const toast = useToastStore();

const tickets = ref([]);
const total = ref(0);
const page = ref(1);
const limit = ref(25);
const loading = ref(false);
const statusFilter = ref("");
const expanded = ref(null);
const detail = ref(null);
const editStatus = ref("open");
const newNote = ref("");

function statusBadge(status) {
  if (status === "resolved" || status === "closed") return "badge-success";
  if (status === "in_progress") return "badge-warning";
  return "badge-primary";
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function reload() {
  loading.value = true;
  try {
    const result = await adminApi.listSupportTickets({ status: statusFilter.value, page: page.value, limit: limit.value });
    tickets.value = result.tickets;
    total.value = result.total;
    page.value = result.page;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

function changePage(p) {
  page.value = p;
  reload();
}

async function toggle(id) {
  if (expanded.value === id) {
    expanded.value = null;
    return;
  }
  expanded.value = id;
  // Cleared immediately (not left holding the PREVIOUS ticket's data) so the
  // panel shows a loading state instead of momentarily rendering the wrong
  // ticket's body/notes under this ticket's header while the fetch is in flight.
  detail.value = null;
  try {
    const { ticket } = await adminApi.getSupportTicket(id);
    detail.value = ticket;
    editStatus.value = ticket.status;
  } catch (err) {
    reportApiError(err);
  }
}

async function saveStatus(id) {
  try {
    await adminApi.updateSupportTicket(id, { status: editStatus.value });
    toast.success(t("admin.support.updated"));
    await reload();
    // Re-fetch directly rather than going through toggle(id): the panel is
    // already expanded at this point, so toggle() would just close it
    // (its "already expanded" branch) and leave `detail` stale instead of
    // refreshing it.
    const { ticket } = await adminApi.getSupportTicket(id);
    detail.value = ticket;
    editStatus.value = ticket.status;
  } catch (err) {
    reportApiError(err);
  }
}

async function addNote(id) {
  if (!newNote.value.trim()) return;
  try {
    await adminApi.addSupportTicketNote(id, newNote.value);
    newNote.value = "";
    const { ticket } = await adminApi.getSupportTicket(id);
    detail.value = ticket;
  } catch (err) {
    reportApiError(err);
  }
}

onMounted(reload);
</script>
