<template>
  <div>
    <div v-if="!finished">
      <div class="progress-bar"><div class="progress-fill" :style="{ width: ((index + 1) / quiz.length) * 100 + '%' }"></div></div>
      <p class="muted mono">Question {{ index + 1 }} / {{ quiz.length }} · {{ current.difficulty }} · {{ current.concept_tested }}</p>
      <h3 class="q">{{ current.question }}</h3>
      <div class="options">
        <button
          v-for="opt in current.options"
          :key="opt"
          class="ghost option"
          :class="optionClass(opt)"
          :disabled="answered"
          @click="pick(opt)"
        >
          {{ opt }}
        </button>
      </div>
      <div v-if="answered" class="card feedback" :class="picked === current.correctAnswer ? 'ok' : 'bad'">
        <strong>{{ picked === current.correctAnswer ? "Correct." : "Not quite." }}</strong>
        {{ current.explanation }}
      </div>
      <button v-if="answered" style="margin-top: 14px" @click="next">
        {{ index === quiz.length - 1 ? "See result" : "Next question" }}
      </button>
    </div>

    <div v-else class="card result">
      <h3>Result: <span class="hl">{{ score }} / {{ quiz.length }}</span></h3>
      <p class="muted">{{ verdict }}</p>
      <button class="ghost" @click="restart">Retake quiz</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({ quiz: { type: Array, required: true } });

const index = ref(0);
const picked = ref(null);
const answered = ref(false);
const score = ref(0);
const finished = ref(false);

const current = computed(() => props.quiz[index.value]);
const verdict = computed(() => {
  const r = score.value / props.quiz.length;
  if (r === 1) return "Perfect — you own this lecture.";
  if (r >= 0.6) return "Solid. Review the explanations for the ones you missed.";
  return "Go back through the study notes, then retake the quiz.";
});

function pick(opt) {
  if (answered.value) return;
  picked.value = opt;
  answered.value = true;
  if (opt === current.value.correctAnswer) score.value++;
}
function optionClass(opt) {
  if (!answered.value) return "";
  if (opt === current.value.correctAnswer) return "correct";
  if (opt === picked.value) return "wrong";
  return "dim";
}
function next() {
  if (index.value === props.quiz.length - 1) {
    finished.value = true;
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
}
</script>

<style scoped>
.progress-bar { height: 5px; border-radius: 999px; background: var(--line); overflow: hidden; margin-bottom: 12px; }
.progress-fill { height: 100%; background: var(--hl); transition: width 0.25s ease; }
.q { font-size: 20px; margin: 8px 0 16px; }
.options { display: flex; flex-direction: column; gap: 10px; }
.option { text-align: left; font-family: var(--font-body); font-weight: 500; }
.option.correct { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
.option.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
.option.dim { opacity: 0.55; }
.feedback { margin-top: 16px; font-size: 14px; }
.feedback.ok { border-color: var(--ok); background: var(--ok-bg); }
.feedback.bad { border-color: var(--bad); background: var(--bad-bg); }
.result { text-align: center; padding: 36px 20px; }
</style>
