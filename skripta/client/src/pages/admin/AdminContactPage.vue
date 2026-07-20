<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.contact.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.contact.subtitle") }}</p>

    <select v-model="statusFilter" class="mb-4 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2.5" @change="reload">
      <option value="">{{ t("admin.errors.allLevels") }}</option>
      <option value="new">{{ t("admin.contact.status.new") }}</option>
      <option value="read">{{ t("admin.contact.status.read") }}</option>
      <option value="responded">{{ t("admin.contact.status.responded") }}</option>
      <option value="archived">{{ t("admin.contact.status.archived") }}</option>
    </select>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>
    <EmptyState v-else-if="!messages.length" :icon="EnvelopeIcon" :title="t('admin.contact.emptyTitle')" :description="t('admin.contact.emptyBody')" />

    <ul v-else class="space-y-3">
      <li v-for="msg in messages" :key="msg._id" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4">
        <div class="flex items-center justify-between cursor-pointer" @click="toggle(msg)">
          <div>
            <p class="text-sm font-medium text-slate-900 dark:text-white">{{ msg.subject }}</p>
            <p class="text-xs text-slate-400">{{ msg.name }} ({{ msg.email }}) · {{ formatDate(msg.createdAt) }}</p>
          </div>
          <span class="badge" :class="statusBadge(msg.status)">{{ t(`admin.contact.status.${msg.status}`) }}</span>
        </div>

        <div v-if="expanded === msg._id" class="mt-4 pt-4 border-t border-slate-100 dark:border-border-dark">
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 whitespace-pre-wrap">{{ msg.message }}</p>
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.users.status") }}</label>
              <select v-model="editStatus" class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2">
                <option value="new">{{ t("admin.contact.status.new") }}</option>
                <option value="read">{{ t("admin.contact.status.read") }}</option>
                <option value="responded">{{ t("admin.contact.status.responded") }}</option>
                <option value="archived">{{ t("admin.contact.status.archived") }}</option>
              </select>
            </div>
            <button class="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition" @click="saveStatus(msg._id)">{{ t("common.save") }}</button>
          </div>
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
import { EnvelopeIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import { useToastStore } from "../../stores/toast.js";
import EmptyState from "../../components/ui/EmptyState.vue";

const { t, lang } = useI18n();
const toast = useToastStore();

const messages = ref([]);
const total = ref(0);
const page = ref(1);
const limit = ref(25);
const loading = ref(false);
const statusFilter = ref("");
const expanded = ref(null);
const editStatus = ref("new");

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(status) {
  if (status === "responded") return "badge-success";
  if (status === "read") return "badge-primary";
  if (status === "archived") return "badge";
  return "badge-warning"; // new
}

async function reload() {
  loading.value = true;
  try {
    const result = await adminApi.listContactMessages({ status: statusFilter.value, page: page.value, limit: limit.value });
    messages.value = result.messages;
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

function toggle(msg) {
  expanded.value = expanded.value === msg._id ? null : msg._id;
  editStatus.value = msg.status;
}

async function saveStatus(id) {
  try {
    await adminApi.updateContactMessage(id, { status: editStatus.value });
    toast.success(t("admin.support.updated"));
    await reload();
  } catch (err) {
    reportApiError(err);
  }
}

onMounted(reload);
</script>
