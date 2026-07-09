<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">New study package</h1>
    <p class="text-slate-500 dark:text-slate-400 mt-1 mb-8">Paste the raw transcript of a lecture, tutorial or explanation. Timestamps are optional.</p>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Lecture title</label>
          <input v-model="form.video_title" maxlength="300" required placeholder="e.g. Turing Machines — Lecture 7" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Subject</label>
          <input v-model="form.subject" maxlength="150" placeholder="e.g. Theoretical Computer Science" class="input-field" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Difficulty preference</label>
        <select v-model="form.difficulty" class="input-field">
          <option value="auto">Auto-detect</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div>
        <div class="flex items-baseline justify-between mb-1.5">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Raw transcript</label>
          <label for="file-input" class="text-xs font-medium text-primary hover:underline cursor-pointer">or upload a .txt file</label>
          <input id="file-input" type="file" accept=".txt" class="sr-only" @change="onFile" />
        </div>
        <textarea
          v-model="form.transcript"
          rows="14"
          required
          placeholder="Paste the full transcript here… or drag & drop a .txt file"
          class="input-field font-mono text-sm resize-y transition"
          :class="dragging ? 'border-primary bg-primary/5' : ''"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        ></textarea>
        <div class="flex items-center gap-3 mt-2">
          <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full transition-all" :class="tooLong ? 'bg-danger' : 'bg-primary'" :style="{ width: pct + '%' }"></div>
          </div>
          <p class="text-xs font-mono text-slate-400 whitespace-nowrap">{{ form.transcript.length.toLocaleString() }} / 400,000</p>
        </div>
      </div>

      <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-3">{{ error }}</div>

      <button
        :disabled="generating || form.transcript.trim().length < 50 || tooLong"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <SparklesIcon class="w-5 h-5" /> Generate study package
      </button>
    </form>

    <!-- Fullscreen generation overlay -->
    <Transition name="fade">
      <div v-if="generating" class="fixed inset-0 z-[80] bg-slate-50/95 dark:bg-canvas-dark/95 backdrop-blur-sm flex flex-col items-center justify-center px-6 text-center">
        <div class="relative w-20 h-20 mb-8">
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-secondary to-accent opacity-30 animate-ping"></div>
          <div class="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white animate-float">
            <SparklesIcon class="w-9 h-9" />
          </div>
        </div>
        <h2 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">Building your study package…</h2>
        <p class="text-slate-500 dark:text-slate-400 max-w-sm transition-opacity duration-300">{{ statusMessages[statusIndex] }}</p>
        <p class="text-xs text-slate-400 mt-4">Usually takes 30–60 seconds</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { SparklesIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";

const router = useRouter();
const toast = useToastStore();
const generating = ref(false);
const error = ref("");
const dragging = ref(false);
const form = reactive({ video_title: "", subject: "", difficulty: "auto", transcript: "" });

const pct = computed(() => Math.min(100, (form.transcript.length / 400000) * 100));
const tooLong = computed(() => form.transcript.length > 400000);

const statusMessages = [
  "Reading the transcript…",
  "Finding the chapters…",
  "Writing the study notes…",
  "Building the quiz and flashcards…",
  "Preparing the chatbot context…",
];
const statusIndex = ref(0);
let statusTimer = null;

function startStatusRotation() {
  statusIndex.value = 0;
  statusTimer = setInterval(() => {
    statusIndex.value = (statusIndex.value + 1) % statusMessages.length;
  }, 3000);
}
function stopStatusRotation() {
  clearInterval(statusTimer);
}
onUnmounted(stopStatusRotation);

async function submit() {
  error.value = "";
  generating.value = true;
  startStatusRotation();
  try {
    const doc = await api.generate({ ...form });
    toast.success("Study package generated.");
    router.push(`/package/${doc._id}`);
  } catch (e) {
    error.value = e.message;
    toast.error(e.message);
  } finally {
    generating.value = false;
    stopStatusRotation();
  }
}

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { form.transcript = String(reader.result || ""); };
  reader.readAsText(file);
}
function onFile(e) { readFile(e.target.files?.[0]); }
function onDrop(e) { dragging.value = false; readFile(e.dataTransfer?.files?.[0]); }
</script>

<style scoped>
.input-field {
  width: 100%;
  border-radius: 0.65rem;
  border: 1.5px solid rgb(226 232 240);
  background: white;
  color: inherit;
  padding: 0.6rem 0.75rem;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.input-field:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent); }
:global(html.dark .input-field) { background: var(--color-surface-dark); border-color: var(--color-border-dark); }
</style>
