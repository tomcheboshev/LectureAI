<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.errors.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.errors.subtitle") }}</p>

    <select v-model="level" class="mb-4 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2.5" @change="reload">
      <option value="">{{ t("admin.errors.allLevels") }}</option>
      <option value="error">Error</option>
      <option value="warn">Warn</option>
    </select>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <EmptyState v-else-if="!logs.length" :icon="ExclamationTriangleIcon" :title="t('admin.errors.emptyTitle')" :description="t('admin.errors.emptyBody')" />

    <ul v-else class="space-y-3">
      <li v-for="log in logs" :key="log._id" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4">
        <div class="flex items-center justify-between mb-1.5">
          <span class="badge badge-danger">{{ log.level }}</span>
          <span class="text-xs text-slate-400">{{ formatDate(log.createdAt) }}</span>
        </div>
        <p class="text-sm font-medium text-slate-900 dark:text-white mb-1">{{ log.message }}</p>
        <pre v-if="log.context" class="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">{{ JSON.stringify(log.context) }}</pre>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ExclamationTriangleIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import EmptyState from "../../components/ui/EmptyState.vue";

const { t, lang } = useI18n();
const logs = ref([]);
const loading = ref(false);
const level = ref("");

async function reload() {
  loading.value = true;
  try {
    const result = await adminApi.getErrorLogs({ level: level.value });
    logs.value = result.logs;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleString(lang.value, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

onMounted(reload);
</script>
