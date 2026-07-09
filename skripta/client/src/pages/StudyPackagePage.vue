<template>
  <div v-if="loading" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="skeleton h-8 w-1/2 rounded mb-3"></div>
    <div class="skeleton h-4 w-2/3 rounded mb-8"></div>
    <div class="skeleton h-64 w-full rounded-2xl"></div>
  </div>

  <div v-else-if="error" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="rounded-2xl border border-danger/30 bg-danger/5 text-danger p-6">{{ error }}</div>
  </div>

  <div v-else-if="pkg" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <RouterLink to="/dashboard" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary transition mb-3">
      <ArrowLeftIcon class="w-4 h-4" /> Dashboard
    </RouterLink>

    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">{{ pkg.metadata.video_title }}</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 mb-3">{{ pkg.metadata.short_description }}</p>
        <div class="flex flex-wrap gap-1.5">
          <span class="badge badge-primary">{{ pkg.metadata.subject }}</span>
          <span class="badge">{{ pkg.metadata.estimated_level }}</span>
          <span class="badge">{{ pkg.metadata.content_type }}</span>
          <span class="badge">~{{ pkg.metadata.estimated_duration_minutes }} min</span>
          <span class="badge">transcript: {{ pkg.metadata.transcript_quality }}</span>
        </div>
      </div>
      <div class="shrink-0 flex items-center gap-2 relative">
        <button class="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-200 dark:border-border-dark px-3.5 py-2 text-sm font-semibold hover:border-slate-400 transition" @click="exportOpen = !exportOpen">
          <ArrowDownTrayIcon class="w-4 h-4" /> Export
        </button>
        <Transition name="fade">
          <div v-if="exportOpen" class="absolute right-0 top-11 z-20 w-44 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-lg py-1.5">
            <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('md')">Markdown (.md)</button>
            <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('json')">JSON (.json)</button>
            <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('print')">Print / Save as PDF</button>
          </div>
        </Transition>
        <button class="inline-flex items-center gap-1.5 rounded-lg border-2 border-danger/30 text-danger px-3.5 py-2 text-sm font-semibold hover:bg-danger/10 transition" @click="confirmDelete = true">
          <TrashIcon class="w-4 h-4" /> Delete
        </button>
      </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Tab nav -->
      <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:w-56 shrink-0 pb-1 lg:pb-0 lg:sticky lg:top-20 lg:self-start">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition"
          :class="tab === t.id ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'"
          @click="tab = t.id"
        >
          <component :is="t.icon" class="w-4.5 h-4.5 shrink-0" />
          {{ t.label }}
        </button>
      </nav>

      <!-- Tab content -->
      <div class="flex-1 min-w-0">
        <Transition name="fade" mode="out-in">
          <!-- SUMMARY -->
          <div v-if="tab === 'summary'" key="summary" class="flex flex-col gap-5">
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">Full lecture summary</h3>
              <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{{ pkg.full_lecture_summary }}</p>
            </div>
            <div class="flex items-center justify-between">
              <h3 class="font-display font-bold text-lg">Chapters</h3>
              <RegenerateButton :package-id="pkg._id" section="summary" @regenerated="(d) => (pkg.summary = d.summary)" />
            </div>
            <div class="relative flex flex-col gap-5 pl-6 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-border-dark">
              <div v-for="(c, i) in pkg.summary" :key="i" class="relative">
                <span class="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary/15"></span>
                <p class="font-mono text-xs text-primary mb-0.5">{{ formatTs(c.timestamp) }}</p>
                <h4 class="font-display font-bold text-slate-900 dark:text-white">{{ c.topic_title }}</h4>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 mb-2">{{ c.description }}</p>
                <ul class="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
                  <li v-for="k in c.key_points" :key="k">{{ k }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- CONCEPTS -->
          <div v-else-if="tab === 'concepts'" key="concepts" class="flex flex-col gap-4">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="core_concepts" @regenerated="(d) => (pkg.core_concepts = d.core_concepts)" />
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div v-for="c in pkg.core_concepts" :key="c.term" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold text-primary mb-1.5">{{ c.term }}</h3>
                <p class="text-sm text-slate-700 dark:text-slate-200 mb-2">{{ c.definition }}</p>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-2"><strong class="text-slate-600 dark:text-slate-300">Why it matters:</strong> {{ c.why_it_matters }}</p>
                <p class="font-mono text-xs bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400">{{ c.example }}</p>
                <ConceptExplainer :package-id="pkg._id" :term="c.term" :definition="c.definition" />
              </div>
            </div>
          </div>

          <!-- NOTES -->
          <div v-else-if="tab === 'notes'" key="notes" class="flex flex-col gap-4">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="study_notes" @regenerated="(d) => (pkg.study_notes = d.study_notes)" />
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">Main ideas</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.main_ideas" :key="x">{{ x }}</li></ul>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">Important details</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.important_details" :key="x">{{ x }}</li></ul>
              </div>
              <div v-if="notes.formulas_or_rules?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">Formulas &amp; rules</h3>
                <ul class="list-disc list-inside font-mono text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.formulas_or_rules" :key="x">{{ x }}</li></ul>
              </div>
              <div v-if="notes.processes_or_steps?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">Processes &amp; steps</h3>
                <ol class="list-decimal list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.processes_or_steps" :key="x">{{ x }}</li></ol>
              </div>
              <div v-if="notes.comparisons?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 sm:col-span-2">
                <h3 class="font-display font-bold mb-2">Comparisons</h3>
                <p v-for="(c, i) in notes.comparisons" :key="i" class="text-sm text-slate-600 dark:text-slate-300 mb-1">
                  <strong class="text-slate-900 dark:text-white">{{ c.concept_a }}</strong> vs <strong class="text-slate-900 dark:text-white">{{ c.concept_b }}</strong>: {{ c.difference }}
                </p>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">Common mistakes</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.common_misunderstandings" :key="x">{{ x }}</li></ul>
              </div>
            </div>
            <div class="rounded-2xl border-2 border-warning/40 bg-warning/5 p-5">
              <h3 class="font-display font-bold mb-2 flex items-center gap-2"><FireIcon class="w-5 h-5 text-warning" /> Exam focus</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-700 dark:text-slate-200"><li v-for="x in notes.exam_focus" :key="x">{{ x }}</li></ul>
            </div>
          </div>

          <!-- GLOSSARY -->
          <div v-else-if="tab === 'glossary'" key="glossary" class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-3">
              <div class="relative max-w-xs flex-1">
                <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input v-model="glossaryQuery" placeholder="Search terms…" class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <RegenerateButton :package-id="pkg._id" section="glossary" @regenerated="(d) => (pkg.glossary = d.glossary)" />
            </div>
            <dl class="rounded-2xl border border-slate-200 dark:border-border-dark divide-y divide-slate-100 dark:divide-border-dark">
              <div v-for="g in filteredGlossary" :key="g.term" class="px-5 py-3.5">
                <dt class="font-display font-bold text-slate-900 dark:text-white">{{ g.term }}</dt>
                <dd class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ g.meaning }}</dd>
              </div>
              <p v-if="filteredGlossary.length === 0" class="px-5 py-6 text-sm text-slate-400 text-center">No terms match "{{ glossaryQuery }}".</p>
            </dl>
          </div>

          <!-- QUIZ -->
          <div v-else-if="tab === 'quiz'" key="quiz" class="max-w-xl mx-auto">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="quiz" @regenerated="(d) => { pkg.quiz = d.quiz; quizKey++; }" />
            </div>
            <QuizPlayer :key="quizKey" :quiz="pkg.quiz" />
          </div>

          <!-- FLASHCARDS -->
          <div v-else-if="tab === 'flashcards'" key="flashcards" class="max-w-xl mx-auto">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="flashcards" @regenerated="(d) => { pkg.flashcards = d.flashcards; flashcardsKey++; }" />
            </div>
            <FlashcardDeck :key="flashcardsKey" :flashcards="pkg.flashcards" />
          </div>

          <!-- PRACTICE TASKS -->
          <div v-else-if="tab === 'practice'" key="practice" class="flex flex-col gap-3">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="practice_tasks" @regenerated="(d) => (pkg.practice_tasks = d.practice_tasks)" />
            </div>
            <div v-for="(t, i) in pkg.practice_tasks" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <span class="badge mb-2" :class="diffTint(t.difficulty)">{{ t.difficulty }}</span>
              <p class="font-medium text-slate-900 dark:text-white mb-2">{{ t.task }}</p>
              <details class="mb-1.5 group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> Hint
                </summary>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 pl-5">{{ t.hint }}</p>
              </details>
              <details class="group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> Solution
                </summary>
                <p class="text-sm text-slate-600 dark:text-slate-300 mt-1.5 pl-5">{{ t.solution }}</p>
              </details>
              <p class="font-mono text-xs text-slate-400 mt-3">uses: {{ (t.concepts_used || []).join(", ") }}</p>
            </div>
          </div>

          <!-- TRUE/FALSE -->
          <div v-else-if="tab === 'truefalse'" key="truefalse">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="true_false_questions" @regenerated="(d) => { pkg.true_false_questions = d.true_false_questions; trueFalseKey++; }" />
            </div>
            <TrueFalseQuiz :key="trueFalseKey" :questions="pkg.true_false_questions" />
          </div>

          <!-- SHORT ANSWER -->
          <div v-else-if="tab === 'shortanswer'" key="shortanswer" class="flex flex-col gap-3">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="short_answer_questions" @regenerated="(d) => (pkg.short_answer_questions = d.short_answer_questions)" />
            </div>
            <div v-for="(q, i) in pkg.short_answer_questions" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <p class="font-medium text-slate-900 dark:text-white mb-2">{{ q.question }}</p>
              <textarea v-model="shortAnswerDrafts[i]" rows="2" placeholder="Type your answer, then reveal the expected one…" class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 mb-2"></textarea>
              <details class="group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> Reveal expected answer
                </summary>
                <div class="mt-1.5 pl-5">
                  <p class="text-sm text-slate-700 dark:text-slate-200">{{ q.expected_answer }}</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-1"><strong>Grading hint:</strong> {{ q.grading_hint }}</p>
                </div>
              </details>
            </div>
          </div>

          <!-- LEARNING PATH -->
          <div v-else-if="tab === 'path'" key="path" class="grid sm:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 sm:col-span-2">
              <h3 class="font-display font-bold mb-3">Learning objectives</h3>
              <ul class="flex flex-col gap-2">
                <li v-for="o in pkg.learning_objectives" :key="o" class="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircleIcon class="w-5 h-5 text-success shrink-0 mt-0.5" /> {{ o }}
                </li>
              </ul>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">Prerequisites</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="p in pkg.prerequisites" :key="p">{{ p }}</li></ul>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">Recommended next steps</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="n in pkg.recommended_next_steps" :key="n">{{ n }}</li></ul>
            </div>
          </div>

          <!-- CHAT -->
          <div v-else-if="tab === 'chat'" key="chat" class="max-w-2xl">
            <ChatPanel :package-id="pkg._id" :suggested-prompts="pkg.chatbot_context?.suggested_student_prompts || []" />
          </div>
        </Transition>
      </div>
    </div>

    <Modal
      :open="confirmDelete"
      title="Delete this study package?"
      confirm-label="Delete"
      @close="confirmDelete = false"
      @confirm="remove"
    >
      This cannot be undone.
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ArrowLeftIcon, TrashIcon, MagnifyingGlassIcon, ChevronRightIcon, ArrowDownTrayIcon,
  FireIcon, CheckCircleIcon, BookOpenIcon, AcademicCapIcon, DocumentTextIcon,
  QueueListIcon, QuestionMarkCircleIcon, Squares2X2Icon, ClipboardDocumentCheckIcon,
  CheckIcon, PencilSquareIcon, MapIcon, ChatBubbleLeftRightIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { downloadMarkdown, downloadJson, openPrintView } from "../composables/useExport.js";
import QuizPlayer from "../components/QuizPlayer.vue";
import FlashcardDeck from "../components/FlashcardDeck.vue";
import TrueFalseQuiz from "../components/TrueFalseQuiz.vue";
import ChatPanel from "../components/ChatPanel.vue";
import ConceptExplainer from "../components/ConceptExplainer.vue";
import RegenerateButton from "../components/RegenerateButton.vue";
import Modal from "../components/ui/Modal.vue";

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const toast = useToastStore();

const pkg = ref(null);
const loading = ref(true);
const error = ref("");
const tab = ref("summary");
const confirmDelete = ref(false);
const glossaryQuery = ref("");
const shortAnswerDrafts = reactive({});
const exportOpen = ref(false);
const quizKey = ref(0);
const flashcardsKey = ref(0);
const trueFalseKey = ref(0);

const tabs = [
  { id: "summary", label: "Summary", icon: BookOpenIcon },
  { id: "concepts", label: "Core Concepts", icon: AcademicCapIcon },
  { id: "notes", label: "Study Notes", icon: DocumentTextIcon },
  { id: "glossary", label: "Glossary", icon: QueueListIcon },
  { id: "quiz", label: "Quiz", icon: QuestionMarkCircleIcon },
  { id: "flashcards", label: "Flashcards", icon: Squares2X2Icon },
  { id: "practice", label: "Practice Tasks", icon: ClipboardDocumentCheckIcon },
  { id: "truefalse", label: "True / False", icon: CheckIcon },
  { id: "shortanswer", label: "Short Answer", icon: PencilSquareIcon },
  { id: "path", label: "Learning Path", icon: MapIcon },
  { id: "chat", label: "AI Tutor", icon: ChatBubbleLeftRightIcon },
];

const notes = computed(() => pkg.value?.study_notes || {});
const filteredGlossary = computed(() => {
  const list = [...(pkg.value?.glossary || [])].sort((a, b) => a.term.localeCompare(b.term));
  const q = glossaryQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((g) => g.term.toLowerCase().includes(q) || g.meaning.toLowerCase().includes(q));
});

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
function diffTint(d) {
  if (d === "easy") return "badge-success";
  if (d === "hard") return "badge-danger";
  return "badge-warning";
}

function doExport(format) {
  exportOpen.value = false;
  if (format === "md") downloadMarkdown(pkg.value);
  else if (format === "json") downloadJson(pkg.value);
  else openPrintView(pkg.value);
}

async function remove() {
  try {
    await api.deletePackage(props.id);
    toast.success("Package deleted.");
    router.push("/dashboard");
  } catch (e) {
    toast.error(e.message);
  } finally {
    confirmDelete.value = false;
  }
}
</script>

<style scoped>
.badge {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono); font-size: 0.6875rem;
  border: 1px solid rgb(226 232 240); border-radius: 999px;
  padding: 0.2rem 0.65rem; color: rgb(100 116 139);
}
:global(html.dark .badge) { border-color: var(--color-border-dark); color: rgb(148 163 184); }
.badge-primary { background: color-mix(in srgb, var(--color-primary) 10%, transparent); border-color: color-mix(in srgb, var(--color-primary) 30%, transparent); color: var(--color-primary); }
.badge-success { background: color-mix(in srgb, var(--color-success) 10%, transparent); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); color: var(--color-success); }
.badge-warning { background: color-mix(in srgb, var(--color-warning) 12%, transparent); border-color: color-mix(in srgb, var(--color-warning) 35%, transparent); color: #92620a; }
.badge-danger { background: color-mix(in srgb, var(--color-danger) 10%, transparent); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); color: var(--color-danger); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.12s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
