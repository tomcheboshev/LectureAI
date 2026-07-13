<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.overview.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.overview.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="stats">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard :icon="UsersIcon" :value="stats.totalUsers" :label="t('admin.overview.totalUsers')" />
        <StatsCard :icon="UserPlusIcon" :value="stats.newUsers" :label="t('admin.overview.newUsers')" tint="bg-success/10" icon-color="text-success" />
        <StatsCard :icon="BoltIcon" :value="stats.activeUsers" :label="t('admin.overview.activeUsers')" tint="bg-secondary/10" icon-color="text-secondary" />
        <StatsCard :icon="SparklesIcon" :value="stats.premiumUsers" :label="t('admin.overview.premiumUsers')" tint="bg-warning/10" icon-color="text-warning" />
      </div>

      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="CurrencyDollarIcon" :value="`$${stats.mrr.toFixed(2)}`" :label="t('admin.overview.mrr')" />
        <StatsCard :icon="CalendarDaysIcon" :value="`$${stats.monthlyRevenue.toFixed(2)}`" :label="t('admin.overview.monthlyRevenue')" />
        <StatsCard :icon="CalendarIcon" :value="`$${stats.annualRevenue.toFixed(2)}`" :label="t('admin.overview.annualRevenue')" />
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.overview.userGrowth") }}</h2>
          <ChartCanvas v-if="growthData" type="line" :data="growthData" :options="chartOptions" />
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.overview.revenueTrend") }}</h2>
          <ChartCanvas v-if="revenueData" type="bar" :data="revenueData" :options="chartOptions" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { UsersIcon, UserPlusIcon, BoltIcon, SparklesIcon, CurrencyDollarIcon, CalendarDaysIcon, CalendarIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import StatsCard from "../../components/StatsCard.vue";
import ChartCanvas from "../../components/admin/ChartCanvas.vue";

const { t } = useI18n();
const stats = ref(null);
const loading = ref(false);

const chartOptions = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

const growthData = computed(() => {
  if (!stats.value) return null;
  return {
    labels: stats.value.userGrowthSeries.map((p) => p.date),
    datasets: [{ label: t("admin.overview.newUsers"), data: stats.value.userGrowthSeries.map((p) => p.count), borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,0.15)", tension: 0.3, fill: true }],
  };
});

const revenueData = computed(() => {
  if (!stats.value) return null;
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
