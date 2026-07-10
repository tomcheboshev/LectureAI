<template>
  <div class="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-border-dark">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="a in actions"
        :key="a.id"
        class="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-border-dark px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5 transition disabled:opacity-40"
        :disabled="loading !== null"
        @click="a.id === 'compare' ? (comparing = !comparing) : run(a.id)"
      >
        <component :is="a.icon" class="w-3.5 h-3.5" />
        {{ t(a.labelKey) }}
      </button>
    </div>

    <form v-if="comparing" class="flex gap-1.5 mt-2" @submit.prevent="run('compare')">
      <input
        v-model="compareWith"
        :placeholder="t('conceptExplainer.comparePlaceholder')"
        class="flex-1 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white" :disabled="!compareWith.trim()">{{ t("conceptExplainer.go") }}</button>
    </form>

    <div v-if="loading" class="mt-2 flex items-center gap-2 text-xs text-slate-400">
      <span class="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></span>
      {{ t("conceptExplainer.thinking") }}
    </div>

    <TransitionGroup name="fade" tag="div" class="flex flex-col gap-2 mt-2">
      <div v-for="r in results" :key="r.id" class="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200">
        <p class="text-[11px] font-semibold text-primary uppercase tracking-wide mb-1">{{ r.label }}</p>
        <p v-html="renderLatexText(r.text)"></p>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref } from "vue";
import {
  LightBulbIcon, MagnifyingGlassPlusIcon, BeakerIcon, ScaleIcon,
  PencilSquareIcon, PuzzlePieceIcon, FaceSmileIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { renderLatexText } from "../composables/useLatex.js";
import { useI18n } from "../composables/useI18n.js";

const props = defineProps({
  packageId: { type: String, required: true },
  term: { type: String, required: true },
  definition: { type: String, default: "" },
});

const toast = useToastStore();
const { t } = useI18n();
const loading = ref(null);
const comparing = ref(false);
const compareWith = ref("");
const results = ref([]);
let nextId = 1;

const actions = [
  { id: "simpler", labelKey: "conceptExplainer.actions.simpler", icon: LightBulbIcon },
  { id: "detail", labelKey: "conceptExplainer.actions.detail", icon: MagnifyingGlassPlusIcon },
  { id: "example", labelKey: "conceptExplainer.actions.example", icon: BeakerIcon },
  { id: "compare", labelKey: "conceptExplainer.actions.compare", icon: ScaleIcon },
  { id: "practice", labelKey: "conceptExplainer.actions.practice", icon: PencilSquareIcon },
  { id: "analogy", labelKey: "conceptExplainer.actions.analogy", icon: PuzzlePieceIcon },
  { id: "eli10", labelKey: "conceptExplainer.actions.eli10", icon: FaceSmileIcon },
];

async function run(actionId) {
  const action = actions.find((a) => a.id === actionId);
  loading.value = actionId;
  try {
    const { result } = await api.explainConcept(props.packageId, {
      term: props.term,
      definition: props.definition,
      action: actionId,
      compareWith: actionId === "compare" ? compareWith.value.trim() : undefined,
    });
    results.value.unshift({ id: nextId++, label: t(action.labelKey), text: result });
    if (actionId === "compare") { comparing.value = false; compareWith.value = ""; }
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = null;
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from { opacity: 0; transform: translateY(-4px); }
</style>
