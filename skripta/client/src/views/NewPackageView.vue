<template>
  <section class="wrap">
    <h1 class="page-title">New <span class="hl">study package</span></h1>
    <p class="muted">Paste the raw transcript of a lecture, tutorial or explanation. Timestamps are optional.</p>

    <form class="card form" @submit.prevent="submit">
      <div class="grid-2">
        <div>
          <label for="title">Lecture title</label>
          <input id="title" v-model="form.video_title" maxlength="300" placeholder="e.g. Turing Machines — Lecture 7" required />
        </div>
        <div>
          <label for="subject">Subject</label>
          <input id="subject" v-model="form.subject" maxlength="150" placeholder="e.g. Theoretical Computer Science" />
        </div>
      </div>

      <div>
        <label for="difficulty">Difficulty preference</label>
        <select id="difficulty" v-model="form.difficulty">
          <option value="auto">Auto-detect</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div>
        <div class="label-row">
          <label for="transcript" style="margin-bottom: 0">Raw transcript</label>
          <label class="upload-link" for="file-input">or upload a .txt file</label>
          <input id="file-input" type="file" accept=".txt" class="visually-hidden" @change="onFile" />
        </div>
        <textarea
          id="transcript"
          v-model="form.transcript"
          rows="14"
          placeholder="Paste the full transcript here… or drag & drop a .txt file"
          required
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        ></textarea>
        <div class="counter-row">
          <div class="counter-bar"><div class="counter-fill" :style="{ width: pct + '%' }" :class="{ warn: tooLong }"></div></div>
          <p class="muted mono" style="margin: 0; white-space: nowrap">{{ form.transcript.length.toLocaleString() }} / 400,000</p>
        </div>
      </div>

      <div v-if="error" class="card error-card">{{ error }}</div>

      <button :disabled="generating || form.transcript.trim().length < 50 || tooLong">
        <span v-if="generating" class="spinner" aria-hidden="true"></span>
        {{ generating ? "Generating… this takes ~30–60 s" : "Generate study package" }}
      </button>
      <p v-if="generating" class="muted" style="margin: 0">
        The AI is reading the transcript and building chapters, notes, a quiz, flashcards, tasks and the chatbot context.
      </p>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api.js";

const router = useRouter();
const generating = ref(false);
const error = ref("");
const dragging = ref(false);
const form = reactive({
  video_title: "",
  subject: "",
  difficulty: "auto",
  transcript: "",
});

const pct = computed(() => Math.min(100, (form.transcript.length / 400000) * 100));
const tooLong = computed(() => form.transcript.length > 400000);

async function submit() {
  error.value = "";
  generating.value = true;
  try {
    const doc = await api.generate({ ...form });
    router.push(`/package/${doc._id}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    generating.value = false;
  }
}

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { form.transcript = String(reader.result || ""); };
  reader.readAsText(file);
}
function onFile(e) {
  readFile(e.target.files?.[0]);
}
function onDrop(e) {
  dragging.value = false;
  readFile(e.dataTransfer?.files?.[0]);
}
</script>

<style scoped>
.wrap { max-width: 760px; }
.page-title { font-size: clamp(28px, 4vw, 34px); font-weight: 800; }
.form { display: flex; flex-direction: column; gap: 18px; margin-top: 22px; }
textarea { resize: vertical; font-family: var(--font-mono); font-size: 13px; transition: border-color 0.15s ease, background 0.15s ease; }
textarea.dragging { border-color: var(--hl); background: var(--hl-soft); }

.label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.upload-link {
  text-transform: none;
  font-weight: 500;
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.counter-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.counter-bar { flex: 1; height: 4px; border-radius: 999px; background: var(--line); overflow: hidden; }
.counter-fill { height: 100%; background: var(--hl); transition: width 0.15s ease; }
.counter-fill.warn { background: var(--bad); }

.error-card { border-color: var(--bad); background: var(--bad-bg); }

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--paper) 40%, transparent);
  border-top-color: var(--paper);
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
