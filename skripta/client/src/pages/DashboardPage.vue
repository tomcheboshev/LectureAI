<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">{{ t("nav.dashboard") }}</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1">{{ t("dashboard.subtitle") }}</p>
      </div>
      <RouterLink to="/new" class="sm:hidden inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
        <PlusIcon class="w-4 h-4" /> {{ t("nav.newPackage") }}
      </RouterLink>
    </div>

    <div v-if="!loading && !error" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard :icon="RectangleStackIcon" :value="packages.length" :label="t('dashboard.stats.studyPackages')" tint="bg-primary/10" icon-color="text-primary" />
      <StatsCard :icon="QuestionMarkCircleIcon" :value="totalQuiz" :label="t('dashboard.stats.quizQuestions')" tint="bg-accent/10" icon-color="text-accent" />
      <StatsCard :icon="Squares2X2Icon" :value="totalFlashcards" :label="t('dashboard.stats.flashcards')" tint="bg-secondary/10" icon-color="text-secondary" />
      <StatsCard :icon="AcademicCapIcon" :value="subjectCount" :label="t('dashboard.stats.subjects')" tint="bg-success/10" icon-color="text-success" />
    </div>

    <div v-if="!loading && !error && auth.limits" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <span class="badge badge-primary capitalize">{{ t("dashboard.plan.badge", { plan: auth.user?.plan }) }}</span>
          <span v-if="auth.user && !auth.user.emailVerified" class="badge badge-warning">{{ t("dashboard.plan.emailNotVerified") }}</span>
        </div>
        <RouterLink v-if="auth.user?.plan === 'free'" to="/settings" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition">
          {{ t("common.upgradeToPro") }} <ArrowRightIcon class="w-3.5 h-3.5" />
        </RouterLink>
      </div>
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t("dashboard.stats.studyPackages") }}</p>
            <p class="text-xs font-mono text-slate-400">{{ auth.usage?.packages ?? 0 }}{{ auth.limits.maxPackages ? ` / ${auth.limits.maxPackages}` : "" }}</p>
          </div>
          <div class="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: packageUsagePct + '%' }"></div>
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("dashboard.plan.storageUsed") }}</p>
          <p class="text-lg font-display font-bold text-slate-900 dark:text-white">{{ formatStorage(auth.usage?.storageChars) }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ t("dashboard.plan.storageDescription") }}</p>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && packages.length > 0" class="flex flex-wrap items-center gap-3 mb-6">
      <div class="relative flex-1 min-w-[180px] max-w-sm">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="query"
          :placeholder="t('dashboard.search.placeholder')"
          class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        />
      </div>
      <select
        v-model="subjectFilter"
        class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      >
        <option value="">{{ t("dashboard.filters.allSubjects") }}</option>
        <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <select
        v-model="statusFilter"
        class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      >
        <option value="">{{ t("dashboard.filters.allStatuses") }}</option>
        <option value="completed">{{ t("dashboard.filters.ready") }}</option>
        <option value="generating">{{ t("dashboard.filters.generating") }}</option>
        <option value="failed">{{ t("dashboard.filters.failed") }}</option>
      </select>
      <span class="text-xs font-mono text-slate-400 whitespace-nowrap ml-auto">{{ t("dashboard.filters.shownCount", { count: filtered.length }) }}</span>
    </div>

    <div v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 h-40">
        <div class="skeleton h-4 w-1/2 rounded mb-3"></div>
        <div class="skeleton h-3 w-3/4 rounded mb-2"></div>
        <div class="skeleton h-3 w-1/3 rounded"></div>
      </div>
    </div>

    <div v-else-if="error" class="rounded-2xl border border-danger/30 bg-danger/5 text-danger p-6">
      <p class="font-semibold mb-1">{{ t("dashboard.error.title") }}</p>
      <p class="text-sm opacity-80">{{ t("dashboard.error.detail", { error }) }}</p>
    </div>

    <EmptyState
      v-else-if="packages.length === 0"
      :icon="RectangleStackIcon"
      :title="t('dashboard.empty.title')"
      :description="t('dashboard.empty.description')"
    >
      <RouterLink to="/new" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary-hover transition">
        {{ t("dashboard.empty.cta") }}
      </RouterLink>
    </EmptyState>

    <EmptyState v-else-if="filtered.length === 0" :icon="MagnifyingGlassIcon" :title="t('dashboard.noMatches.title')" :description="t('dashboard.noMatches.description', { query })" />

    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <PackageCard v-for="p in filtered" :key="p._id" :pkg="p" @refresh="reload" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import {
  PlusIcon, RectangleStackIcon, QuestionMarkCircleIcon,
  Squares2X2Icon, AcademicCapIcon, MagnifyingGlassIcon, ArrowRightIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { useAuthStore } from "../stores/auth.js";
import { useI18n } from "../composables/useI18n.js";
import StatsCard from "../components/StatsCard.vue";
import PackageCard from "../components/PackageCard.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const toast = useToastStore();
const auth = useAuthStore();
const { t } = useI18n();
const packages = ref([]);
const loading = ref(true);
const error = ref("");
const query = ref("");
const subjectFilter = ref("");
const statusFilter = ref("");

const packageUsagePct = computed(() => {
  const limit = auth.limits?.maxPackages;
  if (!limit) return 8; // unlimited plan — show a token sliver, not an empty bar
  return Math.min(100, ((auth.usage?.packages || 0) / limit) * 100);
});

function formatStorage(chars) {
  const n = chars || 0;
  if (n < 1000) return `${n} chars`;
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${(n / 1000000).toFixed(1)}M chars`;
}

const totalQuiz = computed(() => packages.value.reduce((sum, p) => sum + (p.quizCount || 0), 0));
const totalFlashcards = computed(() => packages.value.reduce((sum, p) => sum + (p.flashcardCount || 0), 0));
const subjects = computed(() => [...new Set(packages.value.map((p) => p.metadata?.subject).filter(Boolean))].sort());
const subjectCount = computed(() => subjects.value.length);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return packages.value.filter((p) => {
    if (subjectFilter.value && p.metadata?.subject !== subjectFilter.value) return false;
    if (statusFilter.value) {
      const status = p.status || "completed";
      if (statusFilter.value === "generating" ? status === "completed" || status === "failed" : status !== statusFilter.value) {
        return false;
      }
    }
    if (!q) return true;
    return [p.metadata?.video_title, p.metadata?.subject].some((f) => f?.toLowerCase().includes(q));
  });
});

async function reload() {
  try {
    const [list] = await Promise.all([api.listPackages(), auth.fetchMe().catch(() => {})]);
    packages.value = list;
  } catch (e) {
    toast.error(e.message);
  }
}

onMounted(async () => {
  try {
    const [list] = await Promise.all([api.listPackages(), auth.fetchMe().catch(() => {})]);
    packages.value = list;
  } catch (e) {
    error.value = e.message;
    toast.error(t("toasts.loadPackagesFailed"));
  } finally {
    loading.value = false;
  }
});
</script>
