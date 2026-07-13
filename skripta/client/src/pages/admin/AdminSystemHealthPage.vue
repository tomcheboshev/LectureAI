<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.health.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.health.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="health">
      <div class="grid sm:grid-cols-2 gap-4 mb-6">
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full" :class="health.database.connected ? 'bg-success' : 'bg-danger'"></span>
            <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white">{{ t("admin.health.database") }}</h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ health.database.connected ? t("admin.health.connected") : t("admin.health.disconnected") }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-success"></span>
            <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white">{{ t("admin.health.server") }}</h2>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("admin.health.uptime") }}: {{ formatUptime(health.server.uptimeSeconds) }} · Node {{ health.server.nodeVersion }}</p>
        </div>
      </div>

      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="CpuChipIcon" :value="`${health.server.memoryRssMb} MB`" :label="t('admin.health.memory')" />
        <StatsCard :icon="QueueListIcon" :value="health.queue.running + health.queue.queued" :label="t('admin.health.queueLoad')" />
        <StatsCard :icon="ClockIcon" :value="formatUptime(health.server.uptimeSeconds)" :label="t('admin.health.uptime')" />
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.health.config") }}</h2>
        <ul class="space-y-2">
          <li class="flex items-center justify-between text-sm">
            <span class="text-slate-600 dark:text-slate-300">Gemini API key</span>
            <span class="badge" :class="health.config.geminiConfigured ? 'badge-success' : 'badge-danger'">{{ health.config.geminiConfigured ? t("admin.health.set") : t("admin.health.missing") }}</span>
          </li>
          <li class="flex items-center justify-between text-sm">
            <span class="text-slate-600 dark:text-slate-300">Stripe secret key</span>
            <span class="badge" :class="health.config.stripeConfigured ? 'badge-success' : 'badge-danger'">{{ health.config.stripeConfigured ? t("admin.health.set") : t("admin.health.missing") }}</span>
          </li>
          <li class="flex items-center justify-between text-sm">
            <span class="text-slate-600 dark:text-slate-300">Stripe webhook secret</span>
            <span class="badge" :class="health.config.stripeWebhookConfigured ? 'badge-success' : 'badge-danger'">{{ health.config.stripeWebhookConfigured ? t("admin.health.set") : t("admin.health.missing") }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { CpuChipIcon, QueueListIcon, ClockIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";

const { t } = useI18n();
const health = ref(null);
const loading = ref(false);

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function load() {
  loading.value = true;
  try {
    health.value = await adminApi.getSystemHealth();
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
