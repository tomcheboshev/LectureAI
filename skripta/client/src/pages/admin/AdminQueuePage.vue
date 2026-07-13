<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.queue.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.queue.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="status">
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="BoltIcon" :value="status.running" :label="t('admin.queue.running')" />
        <StatsCard :icon="QueueListIcon" :value="status.queued" :label="t('admin.queue.queued')" />
        <StatsCard :icon="Cog6ToothIcon" :value="status.concurrency" :label="t('admin.queue.concurrency')" />
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 mb-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.queue.runningJobs") }}</h2>
        <p v-if="!status.runningJobs.length" class="text-sm text-slate-400">{{ t("admin.queue.none") }}</p>
        <ul v-else class="divide-y divide-slate-100 dark:divide-border-dark">
          <li v-for="(job, i) in status.runningJobs" :key="i" class="flex items-center justify-between py-2.5 text-sm">
            <span class="badge badge-primary">{{ job.label }}</span>
            <span class="text-slate-500 dark:text-slate-400">{{ elapsedSince(job.startedAt) }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.queue.queuedJobs") }}</h2>
        <p v-if="!status.queuedJobs.length" class="text-sm text-slate-400">{{ t("admin.queue.none") }}</p>
        <ul v-else class="divide-y divide-slate-100 dark:divide-border-dark">
          <li v-for="(job, i) in status.queuedJobs" :key="i" class="flex items-center justify-between py-2.5 text-sm">
            <span class="badge badge-warning">{{ job.label }}</span>
            <span class="text-slate-500 dark:text-slate-400">{{ elapsedSince(job.enqueuedAt) }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { BoltIcon, QueueListIcon, Cog6ToothIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";

const { t } = useI18n();
const status = ref(null);
const loading = ref(false);
let pollTimer = null;

function elapsedSince(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

async function load() {
  try {
    status.value = await adminApi.getQueueStatus();
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loading.value = true;
  load();
  // Matches the existing generation-status polling precedent in
  // StudyPackagePage.vue — no WebSocket/SSE infra exists anywhere in the app.
  pollTimer = setInterval(load, 4000);
});

onBeforeUnmount(() => clearInterval(pollTimer));
</script>
