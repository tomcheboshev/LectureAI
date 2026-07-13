<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.revenue.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.revenue.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="stats">
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="CurrencyDollarIcon" :value="`$${stats.mrr.toFixed(2)}`" :label="t('admin.overview.mrr')" />
        <StatsCard :icon="CalendarDaysIcon" :value="`$${stats.monthlyRevenue.toFixed(2)}`" :label="t('admin.overview.monthlyRevenue')" />
        <StatsCard :icon="CalendarIcon" :value="`$${stats.annualRevenue.toFixed(2)}`" :label="t('admin.overview.annualRevenue')" />
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.overview.revenueTrend") }}</h2>
        <ChartCanvas v-if="revenueData" type="bar" :data="revenueData" :options="chartOptions" :height="320" />
        <p v-else class="text-sm text-slate-400 py-10 text-center">{{ t("admin.revenue.noData") }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { CurrencyDollarIcon, CalendarDaysIcon, CalendarIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";
import ChartCanvas from "../../components/admin/ChartCanvas.vue";

const { t } = useI18n();
const stats = ref(null);
const loading = ref(false);

const chartOptions = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

const revenueData = computed(() => {
  if (!stats.value?.revenueSeries?.length) return null;
  return {
    labels: stats.value.revenueSeries.map((p) => p.month),
    datasets: [{ label: t("admin.overview.monthlyRevenue"), data: stats.value.revenueSeries.map((p) => p.amountUsd), backgroundColor: "#22c55e" }],
  };
});

async function load() {
  loading.value = true;
  try {
    stats.value = await adminApi.getOverview();
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
