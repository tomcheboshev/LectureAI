<template>
  <div class="max-w-xl mx-auto">
    <EmptyState v-if="!quiz || quiz.length === 0" :icon="QuestionMarkCircleIcon" :title="t('quizPlayer.emptyTitle')" :description="t('quizPlayer.emptyDescription')" />

    <div v-else-if="!finished">
      <div class="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-4">
        <div class="h-full bg-primary rounded-full transition-all duration-300" :style="{ width: ((index + 1) / quiz.length) * 100 + '%' }"></div>
      </div>
      <p class="font-mono text-xs text-slate-500 dark:text-slate-400 mb-2">
        {{ t("quizPlayer.questionCounter", { current: index + 1, total: quiz.length, difficulty: current.difficulty, concept: current.concept_tested }) }}
      </p>
      <h3 class="text-xl font-display font-bold text-slate-900 dark:text-white mb-5" v-html="renderLatexText(current.question)"></h3>

      <div class="flex flex-col gap-2.5">
        <button
          v-for="opt in current.options"
          :key="opt"
          :disabled="answered"
          class="text-left px-4 py-3.5 rounded-xl border-2 font-medium text-base transition"
          :class="optionClass(opt)"
          @click="pick(opt)"
          v-html="renderLatexText(opt)"
        ></button>
      </div>

      <div v-if="answered" class="mt-5 rounded-xl border-2 p-5 text-base leading-relaxed" :class="picked === current.correctAnswer ? 'border-success/40 bg-success/5 text-success' : 'border-danger/40 bg-danger/5 text-danger'">
        <strong>{{ picked === current.correctAnswer ? t("quizPlayer.correct") : t("quizPlayer.notQuite") }}</strong>
        <span class="text-slate-600 dark:text-slate-300" v-html="' ' + renderLatexText(current.explanation)"></span>
      </div>

      <button v-if="answered" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition" @click="next">
        {{ index === quiz.length - 1 ? t("quizPlayer.seeResult") : t("quizPlayer.nextQuestion") }} <ArrowRightIcon class="w-4 h-4" />
      </button>
    </div>

    <div v-else class="text-center rounded-2xl border border-slate-200 dark:border-border-dark p-10">
      <h3 class="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">
        {{ t("quizPlayer.resultTitle") }} <span class="text-primary">{{ score }} / {{ quiz.length }}</span>
      </h3>
      <p class="text-slate-500 dark:text-slate-400 mb-6">{{ verdict }}</p>
      <button class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-300 dark:border-border-dark px-5 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="restart">
        <ArrowPathIcon class="w-4 h-4" /> {{ t("quizPlayer.retake") }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { ArrowRightIcon, ArrowPathIcon, QuestionMarkCircleIcon } from "@heroicons/vue/24/outline";
import { fireConfetti } from "../composables/useConfetti.js";
import { renderLatexText } from "../composables/useLatex.js";
import { useI18n } from "../composables/useI18n.js";
import { api } from "../services/api.js";
import EmptyState from "./ui/EmptyState.vue";

const { t } = useI18n();
const props = defineProps({ quiz: { type: Array, default: () => [] }, packageId: { type: String, default: "" } });

const index = ref(0);
const picked = ref(null);
const answered = ref(false);
const score = ref(0);
const finished = ref(false);
const submittedAnswers = ref([]);

const current = computed(() => props.quiz[index.value]);
const verdict = computed(() => {
  const r = score.value / props.quiz.length;
  if (r === 1) return t("quizPlayer.verdict.perfect");
  if (r >= 0.6) return t("quizPlayer.verdict.solid");
  return t("quizPlayer.verdict.retry");
});

function pick(opt) {
  if (answered.value) return;
  picked.value = opt;
  answered.value = true;
  const correct = opt === current.value.correctAnswer;
  if (correct) score.value++;
  submittedAnswers.value.push({ questionIndex: index.value, selected: opt, correct });
}
function optionClass(opt) {
  if (!answered.value) return "border-slate-200 dark:border-border-dark hover:border-primary hover:bg-primary/5";
  if (opt === current.value.correctAnswer) return "border-success bg-success/10 text-success";
  if (opt === picked.value) return "border-danger bg-danger/10 text-danger";
  return "border-slate-200 dark:border-border-dark opacity-50";
}
function next() {
  if (index.value === props.quiz.length - 1) {
    finished.value = true;
    if (score.value === props.quiz.length) fireConfetti();
    if (props.packageId) {
      // Best-effort engagement tracking for the analytics dashboard — a
      // failure here shouldn't interrupt the student's result screen.
      api.submitQuizAttempt(props.packageId, submittedAnswers.value).catch((e) => console.error("Failed to record quiz attempt:", e));
    }
  } else {
    index.value++;
    picked.value = null;
    answered.value = false;
  }
}
function restart() {
  index.value = 0;
  picked.value = null;
  answered.value = false;
  score.value = 0;
  finished.value = false;
  submittedAnswers.value = [];
}
</script>
