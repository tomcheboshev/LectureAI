<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="mb-8">
      <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">{{ t("analytics.title") }}</h1>
      <p class="text-slate-500 dark:text-slate-400 mt-1">{{ t("analytics.subtitle") }}</p>
    </div>

    <div v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 h-24">
        <div class="skeleton h-4 w-1/2 rounded mb-3"></div>
        <div class="skeleton h-6 w-1/3 rounded"></div>
      </div>
    </div>

    <div v-else-if="error" class="rounded-2xl border border-danger/30 bg-danger/5 text-danger p-6">{{ error }}</div>

    <EmptyState
      v-else-if="isEmpty"
      :icon="ChartBarIcon"
      :title="t('analytics.empty.title')"
      :description="t('analytics.empty.description')"
    />

    <template v-else-if="data">
      <!-- Streak -->
      <div class="flex flex-wrap items-center gap-4 mb-6 rounded-2xl border border-slate-200 dark:border-border-dark p-5">
        <div class="flex items-center gap-3">
          <span class="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/10 text-warning shrink-0">
            <FireIcon class="w-6 h-6" />
          </span>
          <div>
            <p class="text-2xl font-display font-bold text-slate-900 dark:text-white leading-tight">
              {{ t("analytics.streak.days", { count: data.streak.current }) }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("analytics.streak.current") }}</p>
          </div>
        </div>
        <div class="h-10 w-px bg-slate-200 dark:bg-border-dark hidden sm:block"></div>
        <div>
          <p class="text-lg font-display font-bold text-slate-700 dark:text-slate-200 leading-tight">
            {{ t("analytics.streak.days", { count: data.streak.longest }) }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("analytics.streak.longest") }}</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatsCard :icon="RectangleStackIcon" :value="data.studyPackages" :label="t('analytics.stats.studyPackages')" tint="bg-primary/10" icon-color="text-primary" />
        <StatsCard :icon="QuestionMarkCircleIcon" :value="data.quiz.totalAttempts" :label="t('analytics.stats.quizAttempts')" tint="bg-accent/10" icon-color="text-accent" />
        <StatsCard :icon="ChartBarIcon" :value="`${data.quiz.averageScorePct}%`" :label="t('analytics.stats.avgScore')" tint="bg-success/10" icon-color="text-success" />
        <StatsCard :icon="Squares2X2Icon" :value="data.flashcards.totalReviewed" :label="t('analytics.stats.flashcardsReviewed')" tint="bg-secondary/10" icon-color="text-secondary" />
        <StatsCard :icon="CheckCircleIcon" :value="`${data.flashcards.masteryPct}%`" :label="t('analytics.stats.mastery')" tint="bg-warning/10" icon-color="text-warning" />
      </div>

      <!-- Activity strip -->
      <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-6">
        <h3 class="font-display font-bold mb-3">{{ t("analytics.activity.title") }}</h3>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="day in activityDays"
            :key="day.date"
            class="w-3 h-3 rounded-sm"
            :class="activityColor(day.count)"
            :title="t('analytics.activity.tooltip', { date: day.date, count: day.count })"
          ></span>
        </div>
      </div>

      <!-- AI usage -->
      <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
        <h3 class="font-display font-bold mb-3">{{ t("analytics.aiUsage.title") }}</h3>
        <div class="grid sm:grid-cols-3 gap-4 mb-2">
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("analytics.aiUsage.totalCalls") }}</p>
            <p class="text-lg font-display font-bold text-slate-900 dark:text-white">{{ data.aiUsage.totalCalls }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("analytics.aiUsage.totalTokens") }}</p>
            <p class="text-lg font-display font-bold text-slate-900 dark:text-white">{{ data.aiUsage.totalTokens.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ t("analytics.aiUsage.estimatedCost") }}</p>
            <p class="text-lg font-display font-bold text-slate-900 dark:text-white">${{ data.aiUsage.estimatedCostUsd.toFixed(4) }}</p>
          </div>
        </div>
        <p class="text-[11px] text-slate-400">{{ t("analytics.aiUsage.disclaimer") }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  FireIcon,
  RectangleStackIcon,
  QuestionMarkCircleIcon,
  Squares2X2Icon,
  CheckCircleIcon,
  ChartBarIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useI18n } from "../composables/useI18n.js";
import StatsCard from "../components/StatsCard.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const { t } = useI18n();
const loading = ref(true);
const error = ref("");
const data = ref(null);

const isEmpty = computed(
  () =>
    data.value &&
    data.value.studyPackages === 0 &&
    data.value.quiz.totalAttempts === 0 &&
    data.value.flashcards.totalReviewed === 0 &&
    data.value.streak.current === 0
);

// Renders a fixed 90-day window ending today, filling in zero-activity days
// that have no DailyActivity document at all, so the strip is always a
// complete rectangle rather than only showing days with data.
const activityDays = computed(() => {
  if (!data.value) return [];
  const byDate = new Map(data.value.activity.map((d) => [d.date, d]));
  const days = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const entry = byDate.get(date);
    const count = entry ? entry.quizAttempts + entry.flashcardReviews + entry.packagesGenerated + entry.chatMessages : 0;
    days.push({ date, count });
  }
  return days;
});

function activityColor(count) {
  if (count === 0) return "bg-slate-200 dark:bg-white/10";
  if (count <= 2) return "bg-primary/30";
  if (count <= 5) return "bg-primary/60";
  return "bg-primary";
}

onMounted(async () => {
  try {
    data.value = await api.getAnalytics();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>
