<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.reports.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.reports.subtitle") }}</p>

    <div class="space-y-3">
      <div v-for="r in reports" :key="r.key" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t(`admin.reports.${r.key}Title`) }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t(`admin.reports.${r.key}Body`) }}</p>
        </div>
        <button
          :disabled="downloading === r.key"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition"
          @click="download(r.key)"
        >
          <ArrowDownTrayIcon class="w-4 h-4" />
          {{ downloading === r.key ? t("admin.support.updated") : t("admin.reports.download") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ArrowDownTrayIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";

const { t } = useI18n();
const downloading = ref(null);

const reports = [{ key: "users" }, { key: "revenue" }, { key: "aiUsage", file: "ai-usage" }];

async function download(key) {
  downloading.value = key;
  try {
    const file = reports.find((r) => r.key === key)?.file || key;
    await adminApi.downloadReport(file);
  } catch (err) {
    reportApiError(err);
  } finally {
    downloading.value = null;
  }
}
</script>
