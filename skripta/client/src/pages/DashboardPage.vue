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

    <div v-if="!loading && !error" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatsCard :icon="RectangleStackIcon" :value="packages.length" label="Study packages" tint="bg-primary/10" icon-color="text-primary" />
      <StatsCard :icon="QuestionMarkCircleIcon" :value="totalQuiz" label="Quiz questions" tint="bg-accent/10" icon-color="text-accent" />
      <StatsCard :icon="Squares2X2Icon" :value="totalFlashcards" label="Flashcards" tint="bg-secondary/10" icon-color="text-secondary" />
      <StatsCard :icon="AcademicCapIcon" :value="subjectCount" label="Subjects" tint="bg-success/10" icon-color="text-success" />
    </div>

    <div v-if="!loading && !error && packages.length > 0" class="flex items-center gap-3 mb-6">
      <div class="relative flex-1 max-w-sm">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="query"
          placeholder="Search by title or subject…"
          class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
        />
      </div>
      <span class="text-xs font-mono text-slate-400 whitespace-nowrap">{{ filtered.length }} shown</span>
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
      <PackageCard v-for="p in filtered" :key="p._id" :pkg="p" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import {
  PlusIcon, RectangleStackIcon, QuestionMarkCircleIcon,
  Squares2X2Icon, AcademicCapIcon, MagnifyingGlassIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import StatsCard from "../components/StatsCard.vue";
import PackageCard from "../components/PackageCard.vue";
import EmptyState from "../components/ui/EmptyState.vue";

const toast = useToastStore();
const packages = ref([]);
const loading = ref(true);
const error = ref("");
const query = ref("");

const totalQuiz = computed(() => packages.value.reduce((sum, p) => sum + (p.quizCount || 0), 0));
const totalFlashcards = computed(() => packages.value.reduce((sum, p) => sum + (p.flashcardCount || 0), 0));
const subjectCount = computed(() => new Set(packages.value.map((p) => p.metadata?.subject).filter(Boolean)).size);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return packages.value;
  return packages.value.filter((p) =>
    [p.metadata?.video_title, p.metadata?.subject].some((f) => f?.toLowerCase().includes(q))
  );
});

onMounted(async () => {
  try {
    packages.value = await api.listPackages();
  } catch (e) {
    error.value = e.message;
    toast.error("Couldn't load your packages.");
  } finally {
    loading.value = false;
  }
});
</script>
