<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.aiUsage.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.aiUsage.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="stats">
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="SparklesIcon" :value="stats.totalCalls" :label="t('admin.aiUsage.totalCalls')" />
        <StatsCard :icon="CpuChipIcon" :value="formatNumber(stats.totalTokens)" :label="t('admin.aiUsage.totalTokens')" />
        <StatsCard :icon="CurrencyDollarIcon" :value="`$${stats.estimatedCostUsd.toFixed(2)}`" :label="t('admin.aiUsage.totalCost')" />
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5 mb-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.aiUsage.costTrend") }}</h2>
        <ChartCanvas v-if="costTrendData" type="line" :data="costTrendData" :options="chartOptions" />
        <p v-else class="text-sm text-slate-400 py-10 text-center">{{ t("admin.aiUsage.noData") }}</p>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.aiUsage.byModel") }}</h2>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th class="py-2 whitespace-nowrap">{{ t("admin.aiUsage.model") }}</th>
              <th class="py-2 whitespace-nowrap">{{ t("admin.aiUsage.totalCalls") }}</th>
              <th class="py-2 whitespace-nowrap">{{ t("admin.aiUsage.totalTokens") }}</th>
              <th class="py-2 whitespace-nowrap">{{ t("admin.aiUsage.totalCost") }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-border-dark">
            <tr v-for="m in stats.byModel" :key="m.model">
              <td class="py-2 pr-4 font-medium text-slate-900 dark:text-white whitespace-nowrap" :title="m.model">{{ m.model }}</td>
              <td class="py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ m.calls }}</td>
              <td class="py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ formatNumber(m.tokens) }}</td>
              <td class="py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">${{ m.costUsd.toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { SparklesIcon, CpuChipIcon, CurrencyDollarIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";
import ChartCanvas from "../../components/admin/ChartCanvas.vue";

const { t } = useI18n();
const stats = ref(null);
const loading = ref(false);
const chartOptions = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

const costTrendData = computed(() => {
  if (!stats.value?.costTrend?.length) return null;
  return {
    labels: stats.value.costTrend.map((p) => p.date),
    datasets: [{ label: t("admin.aiUsage.totalCost"), data: stats.value.costTrend.map((p) => p.costUsd), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", tension: 0.3, fill: true }],
  };
});

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function load() {
  loading.value = true;
  try {
    stats.value = await adminApi.getAiUsage();
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
