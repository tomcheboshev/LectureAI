<template>
  <div class="flex flex-col gap-3">
    <EmptyState v-if="!questions || questions.length === 0" :icon="CheckIcon" :title="t('trueFalseQuiz.emptyTitle')" :description="t('trueFalseQuiz.emptyDescription')" />
    <div v-for="(q, i) in questions" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-6">
      <p class="font-medium text-base text-slate-900 dark:text-white mb-4 leading-relaxed" v-html="renderLatexText(q.statement)"></p>
      <div class="flex gap-2.5">
        <button class="flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition" :class="btnClass(i, true)" :disabled="answers[i] !== null" @click="answer(i, true)">{{ t("trueFalseQuiz.true") }}</button>
        <button class="flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition" :class="btnClass(i, false)" :disabled="answers[i] !== null" @click="answer(i, false)">{{ t("trueFalseQuiz.false") }}</button>
      </div>
      <p v-if="answers[i] !== null" class="text-base mt-4 leading-relaxed" :class="answers[i] === q.answer ? 'text-success' : 'text-danger'">
        <strong>{{ answers[i] === q.answer ? t("trueFalseQuiz.correct") : t("trueFalseQuiz.wrong") }} {{ t("trueFalseQuiz.answerIs", { value: q.answer ? t("trueFalseQuiz.trueVal") : t("trueFalseQuiz.falseVal") }) }}</strong>
        <span class="text-slate-600 dark:text-slate-300" v-html="' ' + renderLatexText(q.explanation)"></span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { CheckIcon } from "@heroicons/vue/24/outline";
import { renderLatexText } from "../composables/useLatex.js";
import { useI18n } from "../composables/useI18n.js";
import EmptyState from "./ui/EmptyState.vue";

const { t } = useI18n();
const props = defineProps({ questions: { type: Array, required: true } });
const answers = ref(props.questions.map(() => null));

function answer(i, val) {
  answers.value[i] = val;
}
function btnClass(i, val) {
  if (answers.value[i] === null) return "border-slate-200 dark:border-border-dark hover:border-primary hover:bg-primary/5";
  const correct = props.questions[i].answer;
  if (val === correct) return "border-success bg-success/10 text-success";
  if (val === answers.value[i]) return "border-danger bg-danger/10 text-danger";
  return "border-slate-200 dark:border-border-dark opacity-50";
}
</script>
