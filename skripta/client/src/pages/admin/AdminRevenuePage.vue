<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.revenue.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.revenue.subtitle") }}</p>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <template v-else-if="stats">
      <div class="grid sm:grid-cols-3 gap-4 mb-4">
        <StatsCard :icon="CurrencyDollarIcon" :value="`$${stats.mrr.toFixed(2)}`" :label="t('admin.overview.mrr')" />
        <StatsCard :icon="CalendarDaysIcon" :value="`$${stats.monthlyRevenue.toFixed(2)}`" :label="t('admin.overview.monthlyRevenue')" />
        <StatsCard :icon="CalendarIcon" :value="`$${stats.annualRevenue.toFixed(2)}`" :label="t('admin.overview.annualRevenue')" />
      </div>

      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <StatsCard :icon="ChartBarIcon" :value="`$${stats.arr.toFixed(2)}`" :label="t('admin.revenue.arr')" />
        <StatsCard :icon="ArrowTrendingDownIcon" :value="`${(stats.churnRate * 100).toFixed(1)}%`" :label="t('admin.revenue.churnRate')" />
        <StatsCard :icon="UserGroupIcon" :value="`$${stats.ltv.toFixed(2)}`" :label="t('admin.revenue.ltv')" />
      </div>
      <p class="text-xs text-slate-400 -mt-4 mb-6">{{ t("admin.revenue.churnRateNote") }}</p>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5 mb-6">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.overview.revenueTrend") }}</h2>
        <ChartCanvas v-if="revenueData" type="bar" :data="revenueData" :options="chartOptions" :height="320" />
        <p v-else class="text-sm text-slate-400 py-10 text-center">{{ t("admin.revenue.noData") }}</p>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-6">
        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-3">{{ t("admin.revenue.refunds") }}</h2>
          <p v-if="!stats.refunds.length" class="text-sm text-slate-400 py-4 text-center">{{ t("admin.revenue.refundsEmpty") }}</p>
          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="r in stats.refunds" :key="r.invoiceId" class="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm">
              <span class="text-slate-600 dark:text-slate-300 truncate">{{ r.userEmail }}</span>
              <span class="font-medium text-slate-800 dark:text-slate-100">{{ (r.amountRefunded / 100).toFixed(2) }} {{ r.currency?.toUpperCase() }}</span>
              <span v-if="r.disputed" class="badge badge-danger">{{ t("admin.revenue.disputed") }}</span>
            </li>
          </ul>
        </div>

        <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
          <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-3">{{ t("admin.revenue.cancelledSubscriptions") }}</h2>
          <p v-if="!stats.cancelledSubscriptions.length" class="text-sm text-slate-400 py-4 text-center">{{ t("admin.revenue.cancelledEmpty") }}</p>
          <ul v-else class="flex flex-col gap-1.5">
            <li v-for="u in stats.cancelledSubscriptions" :key="u._id" class="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm">
              <span class="text-slate-600 dark:text-slate-300 truncate">{{ u.email }}</span>
              <span v-if="u.cancelAtPeriodEnd && u.subscriptionStatus !== 'canceled'" class="badge badge-warning">{{ t("admin.revenue.scheduledToCancel") }}</span>
              <span v-else class="badge">{{ u.subscriptionStatus }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-5">
        <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-1">{{ t("admin.revenue.studentDiscounts") }}</h2>
        <p class="text-xs text-slate-400 mb-3">{{ t("admin.revenue.studentDiscountsActive", { count: stats.studentDiscounts.activeCount }) }}</p>
        <p v-if="!stats.studentDiscounts.users.length" class="text-sm text-slate-400 py-4 text-center">{{ t("admin.revenue.studentDiscountsEmpty") }}</p>
        <ul v-else class="flex flex-col gap-1.5">
          <li v-for="u in stats.studentDiscounts.users" :key="u._id" class="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm">
            <span class="text-slate-600 dark:text-slate-300 truncate">{{ u.email }}</span>
            <span class="badge" :class="u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing' ? 'badge-success' : ''">{{ u.subscriptionStatus }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { CurrencyDollarIcon, CalendarDaysIcon, CalendarIcon, ChartBarIcon, ArrowTrendingDownIcon, UserGroupIcon } from "@heroicons/vue/24/outline";
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
