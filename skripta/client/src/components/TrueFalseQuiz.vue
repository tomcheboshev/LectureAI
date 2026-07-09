<template>
  <div class="flex flex-col gap-3">
    <div v-for="(q, i) in questions" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
      <p class="font-medium text-slate-900 dark:text-white mb-3" v-html="renderLatexText(q.statement)"></p>
      <div class="flex gap-2.5">
        <button class="flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition" :class="btnClass(i, true)" :disabled="answers[i] !== null" @click="answer(i, true)">True</button>
        <button class="flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition" :class="btnClass(i, false)" :disabled="answers[i] !== null" @click="answer(i, false)">False</button>
      </div>
      <p v-if="answers[i] !== null" class="text-sm mt-3" :class="answers[i] === q.answer ? 'text-success' : 'text-danger'">
        <strong>{{ answers[i] === q.answer ? "Correct" : "Wrong" }} — answer is {{ q.answer ? "TRUE" : "FALSE" }}.</strong>
        <span class="text-slate-600 dark:text-slate-300" v-html="' ' + renderLatexText(q.explanation)"></span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { renderLatexText } from "../composables/useLatex.js";

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
