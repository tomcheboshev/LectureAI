<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.generation.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.generation.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="files && generation">
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="DocumentTextIcon" :value="files.totalFiles" :label="t('admin.generation.uploadedFiles')" />
        <StatsCard :icon="CircleStackIcon" :value="formatChars(files.totalStorageChars)" :label="t('admin.generation.storageUsed')" />
        <StatsCard :icon="ClockIcon" :value="`${generation.avgDurationSeconds}s`" :label="t('admin.generation.avgDuration')" />
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.generation.byStatus") }}</h2>
          <ul class="divide-y divide-slate-100 dark:divide-border-dark">
            <li v-for="(count, status) in generation.byStatus" :key="status" class="flex items-center justify-between py-2 text-sm">
              <span class="badge" :class="statusBadge(status)">{{ status }}</span>
              <span class="font-medium text-slate-900 dark:text-white">{{ count }}</span>
            </li>
          </ul>
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.generation.bySourceType") }}</h2>
          <ul class="divide-y divide-slate-100 dark:divide-border-dark">
            <li v-for="(count, type) in generation.bySourceType" :key="type" class="flex items-center justify-between py-2 text-sm">
              <span class="text-slate-600 dark:text-slate-300">{{ type }}</span>
              <span class="font-medium text-slate-900 dark:text-white">{{ count }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { DocumentTextIcon, CircleStackIcon, ClockIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";

const { t } = useI18n();
const files = ref(null);
const generation = ref(null);
const loading = ref(false);

function statusBadge(status) {
  if (status === "completed") return "badge-success";
  if (status === "failed") return "badge-danger";
  return "badge-primary";
}

function formatChars(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function load() {
  loading.value = true;
  try {
    const [f, g] = await Promise.all([adminApi.getFileStorageStats(), adminApi.getGenerationStats()]);
    files.value = f;
    generation.value = g;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
