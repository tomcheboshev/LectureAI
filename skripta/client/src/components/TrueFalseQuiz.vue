<template>
  <div class="list">
    <div v-for="(q, i) in questions" :key="i" class="card">
      <p class="stmt">{{ q.statement }}</p>
      <div class="row">
        <button class="ghost" :class="btnClass(i, true)" :disabled="answers[i] !== null" @click="answer(i, true)">True</button>
        <button class="ghost" :class="btnClass(i, false)" :disabled="answers[i] !== null" @click="answer(i, false)">False</button>
      </div>
      <p v-if="answers[i] !== null" class="expl" :class="answers[i] === q.answer ? 'ok-text' : 'bad-text'">
        <strong>{{ answers[i] === q.answer ? "Correct" : "Wrong" }} — answer is {{ q.answer ? "TRUE" : "FALSE" }}.</strong>
        {{ q.explanation }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({ questions: { type: Array, required: true } });
const answers = ref(props.questions.map(() => null));

function answer(i, val) {
  answers.value[i] = val;
}
function btnClass(i, val) {
  if (answers.value[i] === null) return "";
  const correct = props.questions[i].answer;
  if (val === correct) return "correct";
  if (val === answers.value[i]) return "wrong";
  return "dim";
}
</script>

<style scoped>
.list { display: flex; flex-direction: column; gap: 14px; }
.stmt { font-weight: 500; margin: 0 0 12px; }
.row { display: flex; gap: 10px; }
.correct { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
.dim { opacity: 0.5; }
.expl { font-size: 14px; margin: 12px 0 0; }
.ok-text strong { color: var(--ok); }
.bad-text strong { color: var(--bad); }
</style>
