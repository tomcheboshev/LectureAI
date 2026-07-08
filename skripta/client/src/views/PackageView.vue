<template>
  <section v-if="loading" class="muted">Loading package…</section>
  <section v-else-if="error" class="card" style="border-color: var(--bad)">{{ error }}</section>

  <section v-else-if="pkg">
    <header class="head">
      <div>
        <h1 class="title">{{ pkg.metadata.video_title }}</h1>
        <p class="muted" style="margin: 2px 0 10px">{{ pkg.metadata.short_description }}</p>
        <div>
          <span class="badge yellow">{{ pkg.metadata.subject }}</span>
          <span class="badge">{{ pkg.metadata.estimated_level }}</span>
          <span class="badge">{{ pkg.metadata.content_type }}</span>
          <span class="badge">~{{ pkg.metadata.estimated_duration_minutes }} min</span>
          <span class="badge">transcript: {{ pkg.metadata.transcript_quality }}</span>
        </div>
      </div>
      <button class="ghost danger" @click="remove">Delete</button>
    </header>

    <nav class="tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: tab === t.id }"
        role="tab"
        :aria-selected="tab === t.id"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <!-- OVERVIEW -->
    <div v-if="tab === 'overview'" class="pane">
      <div class="card">
        <h3>Full lecture summary</h3>
        <p>{{ pkg.full_lecture_summary }}</p>
      </div>

      <h3 class="section-h"><span class="hl">Chapters</span></h3>
      <div class="chapters">
        <div v-for="(c, i) in pkg.summary" :key="i" class="card chapter">
          <div class="ts mono">{{ formatTs(c.timestamp) }}</div>
          <div>
            <h4>{{ c.topic_title }}</h4>
            <p class="muted" style="margin: 0 0 8px">{{ c.description }}</p>
            <ul class="tight">
              <li v-for="k in c.key_points" :key="k">{{ k }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 20px">
        <div class="card">
          <h3>Learning objectives</h3>
          <ul class="tight"><li v-for="o in pkg.learning_objectives" :key="o">{{ o }}</li></ul>
        </div>
        <div class="card">
          <h3>Prerequisites</h3>
          <ul class="tight"><li v-for="p in pkg.prerequisites" :key="p">{{ p }}</li></ul>
          <h3 style="margin-top: 16px">Next steps</h3>
          <ul class="tight"><li v-for="n in pkg.recommended_next_steps" :key="n">{{ n }}</li></ul>
        </div>
      </div>
    </div>

    <!-- CONCEPTS -->
    <div v-else-if="tab === 'concepts'" class="pane">
      <div class="grid-2">
        <div v-for="c in pkg.core_concepts" :key="c.term" class="card">
          <h3><span class="hl">{{ c.term }}</span></h3>
          <p>{{ c.definition }}</p>
          <p class="muted"><strong>Why it matters:</strong> {{ c.why_it_matters }}</p>
          <p class="mono example">{{ c.example }}</p>
        </div>
      </div>
      <h3 class="section-h"><span class="hl">Glossary</span></h3>
      <div class="card">
        <dl class="glossary">
          <template v-for="g in pkg.glossary" :key="g.term">
            <dt>{{ g.term }}</dt>
            <dd class="muted">{{ g.meaning }}</dd>
          </template>
        </dl>
      </div>
    </div>

    <!-- NOTES -->
    <div v-else-if="tab === 'notes'" class="pane">
      <div class="grid-2">
        <div class="card">
          <h3>Main ideas</h3>
          <ul class="tight"><li v-for="x in notes.main_ideas" :key="x">{{ x }}</li></ul>
        </div>
        <div class="card">
          <h3>Important details</h3>
          <ul class="tight"><li v-for="x in notes.important_details" :key="x">{{ x }}</li></ul>
        </div>
        <div v-if="notes.formulas_or_rules?.length" class="card">
          <h3>Formulas &amp; rules</h3>
          <ul class="tight mono"><li v-for="x in notes.formulas_or_rules" :key="x">{{ x }}</li></ul>
        </div>
        <div v-if="notes.processes_or_steps?.length" class="card">
          <h3>Processes &amp; steps</h3>
          <ol class="tight"><li v-for="x in notes.processes_or_steps" :key="x">{{ x }}</li></ol>
        </div>
        <div v-if="notes.comparisons?.length" class="card">
          <h3>Comparisons</h3>
          <p v-for="(c, i) in notes.comparisons" :key="i">
            <strong>{{ c.concept_a }}</strong> vs <strong>{{ c.concept_b }}</strong>:
            <span class="muted">{{ c.difference }}</span>
          </p>
        </div>
        <div class="card">
          <h3>Common mistakes</h3>
          <ul class="tight"><li v-for="x in notes.common_misunderstandings" :key="x">{{ x }}</li></ul>
        </div>
      </div>
      <div class="card exam-focus">
        <h3>Exam focus</h3>
        <ul class="tight"><li v-for="x in notes.exam_focus" :key="x">{{ x }}</li></ul>
      </div>
    </div>

    <!-- QUIZ -->
    <div v-else-if="tab === 'quiz'" class="pane narrow">
      <QuizPlayer :quiz="pkg.quiz" />
    </div>

    <!-- FLASHCARDS -->
    <div v-else-if="tab === 'flashcards'" class="pane">
      <FlashcardDeck :flashcards="pkg.flashcards" />
    </div>

    <!-- PRACTICE -->
    <div v-else-if="tab === 'practice'" class="pane">
      <h3 class="section-h"><span class="hl">Practice tasks</span></h3>
      <div class="card task" v-for="(t, i) in pkg.practice_tasks" :key="i">
        <p><span class="badge">{{ t.difficulty }}</span></p>
        <p class="stmt">{{ t.task }}</p>
        <details><summary>Hint</summary><p class="muted">{{ t.hint }}</p></details>
        <details><summary>Solution</summary><p>{{ t.solution }}</p></details>
        <p class="muted mono" style="margin: 8px 0 0">uses: {{ (t.concepts_used || []).join(", ") }}</p>
      </div>

      <h3 class="section-h"><span class="hl">True or false</span></h3>
      <TrueFalseQuiz :questions="pkg.true_false_questions" />

      <h3 class="section-h"><span class="hl">Short answer</span></h3>
      <div class="card task" v-for="(q, i) in pkg.short_answer_questions" :key="'sa' + i">
        <p class="stmt">{{ q.question }}</p>
        <details><summary>Expected answer</summary>
          <p>{{ q.expected_answer }}</p>
          <p class="muted"><strong>Grading hint:</strong> {{ q.grading_hint }}</p>
        </details>
      </div>
    </div>

    <!-- CHAT -->
    <div v-else-if="tab === 'chat'" class="pane narrow">
      <ChatPanel
        :package-id="pkg._id"
        :suggested-prompts="pkg.chatbot_context?.suggested_student_prompts || []"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api.js";
import QuizPlayer from "../components/QuizPlayer.vue";
import FlashcardDeck from "../components/FlashcardDeck.vue";
import TrueFalseQuiz from "../components/TrueFalseQuiz.vue";
import ChatPanel from "../components/ChatPanel.vue";

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const pkg = ref(null);
const loading = ref(true);
const error = ref("");
const tab = ref("overview");

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "concepts", label: "Concepts" },
  { id: "notes", label: "Study notes" },
  { id: "quiz", label: "Quiz" },
  { id: "flashcards", label: "Flashcards" },
  { id: "practice", label: "Practice" },
  { id: "chat", label: "Ask the lecture" },
];

const notes = computed(() => pkg.value?.study_notes || {});

onMounted(async () => {
  try {
    pkg.value = await api.getPackage(props.id);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

function formatTs(sec) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

async function remove() {
  if (!confirm("Delete this study package? This cannot be undone.")) return;
  await api.deletePackage(props.id);
  router.push("/");
}
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.title { font-size: 30px; font-weight: 800; }
.danger { border-color: var(--bad); color: var(--bad); }
.danger:hover { background: var(--bad-bg); }

.tabs {
  display: flex;
  gap: 4px;
  margin: 24px 0 22px;
  border-bottom: 1.5px solid var(--line);
  overflow-x: auto;
}
.tab {
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: var(--font-display);
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 0;
  white-space: nowrap;
}
.tab:hover { color: var(--ink); transform: none; }
.tab.active {
  color: var(--ink);
  background: linear-gradient(transparent 62%, var(--hl) 62%, var(--hl) 96%, transparent 96%);
}

.pane { display: flex; flex-direction: column; gap: 14px; }
.pane.narrow { max-width: 640px; margin: 0 auto; width: 100%; }
.section-h { margin: 14px 0 2px; font-size: 20px; }
.chapters { display: flex; flex-direction: column; gap: 12px; }
.chapter { display: grid; grid-template-columns: 64px 1fr; gap: 14px; }
.ts { color: var(--muted); padding-top: 3px; }
.example { background: var(--paper); border: 1px dashed var(--line); border-radius: 8px; padding: 8px 10px; }
.glossary dt { font-family: var(--font-display); font-weight: 700; margin-top: 10px; }
.glossary dd { margin: 2px 0 0; }
.exam-focus { border-color: var(--hl); background: var(--hl-soft); }
.task .stmt { font-weight: 500; }
details { margin: 6px 0; }
summary { cursor: pointer; font-family: var(--font-display); font-weight: 600; font-size: 14px; }
</style>
