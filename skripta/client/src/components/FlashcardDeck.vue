<template>
  <div class="max-w-xl mx-auto">
    <EmptyState v-if="!flashcards || flashcards.length === 0" :icon="Squares2X2Icon" :title="t('flashcardDeck.emptyTitle')" :description="t('flashcardDeck.emptyDescription')" />

    <template v-else>
    <div class="flex items-center justify-between mb-3 text-sm">
      <p class="font-mono text-slate-500 dark:text-slate-400">{{ t("flashcardDeck.cardCounter", { current: index + 1, total: cards.length, category: current.category }) }}</p>
      <p class="font-mono text-slate-500 dark:text-slate-400">{{ t("flashcardDeck.learnedCounter", { count: learned.size }) }}</p>
    </div>

    <button
      class="block w-full [perspective:1200px] mb-5"
      :aria-label="flipped ? t('flashcardDeck.showFront') : t('flashcardDeck.showBack')"
      @click="flipped = !flipped"
    >
      <div class="relative w-full min-h-[240px] transition-transform duration-500 [transform-style:preserve-3d]" :class="flipped ? '[transform:rotateY(180deg)]' : ''">
        <div class="absolute inset-0 [backface-visibility:hidden] rounded-2xl border-2 border-slate-900 dark:border-white/20 bg-white dark:bg-surface-dark shadow-[4px_4px_0_var(--color-primary)] flex flex-col items-center justify-center overflow-y-auto p-8 text-center">
          <span class="absolute top-3 left-4 font-mono text-[10px] tracking-widest text-slate-400">{{ t("flashcardDeck.front") }}</span>
          <CheckCircleIcon v-if="learned.has(current.front)" class="absolute top-3 right-4 w-5 h-5 text-success" />
          <p class="text-lg font-medium text-slate-900 dark:text-white" v-html="renderLatexText(current.front)"></p>
          <span class="absolute bottom-3 text-xs text-slate-400">{{ t("flashcardDeck.tapToFlip") }}</span>
        </div>
        <div class="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border-2 border-primary bg-primary/5 dark:bg-primary/10 flex flex-col items-center justify-center overflow-y-auto p-8 text-center">
          <span class="absolute top-3 left-4 font-mono text-[10px] tracking-widest text-slate-400">{{ t("flashcardDeck.back") }}</span>
          <p class="text-base text-slate-800 dark:text-slate-100" v-html="renderLatexText(current.back)"></p>
        </div>
      </div>
    </button>

    <div class="flex flex-wrap items-center justify-center gap-2 mb-4">
      <button class="btn-ghost" :disabled="index === 0" @click="move(-1)">← {{ t("flashcardDeck.prev") }}</button>
      <button class="btn-ghost" @click="toggleLearned">
        <CheckCircleIcon class="w-4 h-4" /> {{ learned.has(current.front) ? t("flashcardDeck.learned") : t("flashcardDeck.markAsLearned") }}
      </button>
      <button class="btn-ghost" @click="shuffle"><ArrowPathIcon class="w-4 h-4" /> {{ t("flashcardDeck.shuffle") }}</button>
      <button class="btn-primary" :disabled="index === cards.length - 1" @click="move(1)">{{ t("flashcardDeck.next") }} →</button>
    </div>

    <div class="flex justify-center gap-1.5">
      <span v-for="(_, i) in cards" :key="i" class="w-1.5 h-1.5 rounded-full transition-all" :class="i === index ? 'bg-primary w-4' : 'bg-slate-300 dark:bg-white/20'"></span>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { CheckCircleIcon, ArrowPathIcon, Squares2X2Icon } from "@heroicons/vue/24/outline";
import { renderLatexText } from "../composables/useLatex.js";
import { useI18n } from "../composables/useI18n.js";
import { api } from "../services/api.js";
import EmptyState from "./ui/EmptyState.vue";

const { t } = useI18n();
const props = defineProps({ flashcards: { type: Array, default: () => [] }, packageId: { type: String, default: "" } });

const order = ref(props.flashcards.map((_, i) => i));
const index = ref(0);
const flipped = ref(false);
const learned = ref(new Set());

const cards = computed(() => order.value.map((i) => props.flashcards[i]));
const current = computed(() => cards.value[index.value]);

function move(step) {
  index.value = Math.min(Math.max(index.value + step, 0), cards.value.length - 1);
  flipped.value = false;
}
function shuffle() {
  order.value = [...order.value].sort(() => Math.random() - 0.5);
  index.value = 0;
  flipped.value = false;
}
function toggleLearned() {
  const key = current.value.front;
  const nowLearned = !learned.value.has(key);
  nowLearned ? learned.value.add(key) : learned.value.delete(key);
  learned.value = new Set(learned.value);

  if (props.packageId) {
    const originalIndex = order.value[index.value];
    // Best-effort engagement tracking — a failure here shouldn't block the
    // student from continuing to review cards.
    api.submitFlashcardReview(props.packageId, originalIndex, nowLearned).catch((e) => console.error("Failed to record flashcard review:", e));
  }
}
</script>

<style scoped>
.btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 600; font-size: 0.8125rem; padding: 0.55rem 0.9rem;
  border-radius: 0.6rem; border: 1.5px solid rgb(226 232 240);
  color: inherit; transition: background 0.15s ease;
}
.btn-ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--color-primary) 8%, transparent); border-color: var(--color-primary); }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
:global(html.dark .btn-ghost) { border-color: var(--color-border-dark); }
.btn-primary {
  font-weight: 700; font-size: 0.8125rem; padding: 0.55rem 1.1rem;
  border-radius: 0.6rem; background: var(--color-primary); color: white;
  transition: background 0.15s ease, transform 0.1s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
