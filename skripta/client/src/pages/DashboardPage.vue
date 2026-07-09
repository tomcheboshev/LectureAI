<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">Dashboard</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1">Every lecture you've processed, ready for revision.</p>
      </div>
      <RouterLink to="/new" class="sm:hidden inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
        <PlusIcon class="w-4 h-4" /> New package
      </RouterLink>
    </div>

    <div v-if="!loading && !error" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard :icon="RectangleStackIcon" :value="packages.length" label="Study packages" tint="bg-primary/10" icon-color="text-primary" />
      <StatsCard :icon="QuestionMarkCircleIcon" :value="totalQuiz" label="Quiz questions" tint="bg-accent/10" icon-color="text-accent" />
      <StatsCard :icon="Squares2X2Icon" :value="totalFlashcards" label="Flashcards" tint="bg-secondary/10" icon-color="text-secondary" />
      <StatsCard :icon="AcademicCapIcon" :value="subjectCount" label="Subjects" tint="bg-success/10" icon-color="text-success" />
    </div>

    <div v-if="!loading && !error && auth.limits" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <span class="badge badge-primary capitalize">{{ auth.user?.plan }} plan</span>
          <span v-if="auth.user && !auth.user.emailVerified" class="badge badge-warning">Email not verified</span>
        </div>
        <RouterLink v-if="auth.user?.plan === 'free'" to="/settings" class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover transition">
          Upgrade to Pro <ArrowRightIcon class="w-3.5 h-3.5" />
        </RouterLink>
      </div>
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Study packages</p>
            <p class="text-xs font-mono text-slate-400">{{ auth.usage?.packages ?? 0 }}{{ auth.limits.maxPackages ? ` / ${auth.limits.maxPackages}` : "" }}</p>
          </div>
          <div class="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: packageUsagePct + '%' }"></div>
          </div>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Storage used</p>
          <p class="text-lg font-display font-bold text-slate-900 dark:text-white">{{ formatStorage(auth.usage?.storageChars) }}</p>
          <p class="text-xs text-slate-400 mt-0.5">Extracted text across all your study packages</p>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && packages.length > 0" class="flex flex-wrap items-center gap-3 mb-6">
      <div class="relative flex-1 min-w-[180px] max-w-sm">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="query"
          placeholder="Search by title or subject…"
          class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        />
      </div>
      <select
        v-model="subjectFilter"
        class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      >
        <option value="">All subjects</option>
        <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <select
        v-model="statusFilter"
        class="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      >
        <option value="">All statuses</option>
        <option value="completed">Ready</option>
        <option value="generating">Generating</option>
        <option value="failed">Failed</option>
      </select>
      <span class="text-xs font-mono text-slate-400 whitespace-nowrap ml-auto">{{ filtered.length }} shown</span>
    </div>

    <div v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 h-40">
        <div class="skeleton h-4 w-1/2 rounded mb-3"></div>
        <div class="skeleton h-3 w-3/4 rounded mb-2"></div>
        <div class="skeleton h-3 w-1/3 rounded"></div>
      </div>
    </div>

    <div v-else-if="error" class="rounded-2xl border border-danger/30 bg-danger/5 text-danger p-6">
      <p class="font-semibold mb-1">Couldn't load your packages.</p>
      <p class="text-sm opacity-80">{{ error }} — is the API server running?</p>
    </div>

    <EmptyState
      v-else-if="packages.length === 0"
      :icon="RectangleStackIcon"
      title="No packages yet"
      description="Paste your first lecture transcript and LectureAI will build the full study kit — summary, quiz, flashcards and a chatbot."
    >
      <RouterLink to="/new" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary-hover transition">
        Create your first package
      </RouterLink>
    </EmptyState>

    <EmptyState v-else-if="filtered.length === 0" :icon="MagnifyingGlassIcon" title="No matches" :description="`Nothing matches “${query}”. Try a different search.`" />

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
import StatsCard from "../components/StatsCard.vue";
import PackageCard from "../components/PackageCard.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const toast = useToastStore();
const auth = useAuthStore();
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
    toast.error("Couldn't load your packages.");
  } finally {
    loading.value = false;
  }
});
</script>
