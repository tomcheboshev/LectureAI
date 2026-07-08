<template>
  <section class="wrap">
    <h1 class="page-title">New <span class="hl">study package</span></h1>
    <p class="muted">Paste the raw transcript of a lecture, tutorial or explanation. Timestamps are optional.</p>

    <form class="card form" @submit.prevent="submit">
      <div class="grid-2">
        <div>
          <label for="title">Lecture title</label>
          <input id="title" v-model="form.video_title" placeholder="e.g. Turing Machines — Lecture 7" required />
        </div>
        <div>
          <label for="subject">Subject</label>
          <input id="subject" v-model="form.subject" placeholder="e.g. Theoretical Computer Science" />
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
        <label for="transcript">Raw transcript</label>
        <textarea
          id="transcript"
          v-model="form.transcript"
          rows="14"
          placeholder="Paste the full transcript here…"
          required
        ></textarea>
        <p class="muted mono" style="margin: 4px 0 0">{{ form.transcript.length.toLocaleString() }} characters</p>
      </div>

      <div v-if="error" class="card" style="border-color: var(--bad); background: var(--bad-bg)">{{ error }}</div>

      <button :disabled="generating || form.transcript.trim().length < 50">
        {{ generating ? "Generating… this takes ~30–60 s" : "Generate study package" }}
      </button>
      <p v-if="generating" class="muted" style="margin: 0">
        Claude is reading the transcript and building chapters, notes, a quiz, flashcards, tasks and the chatbot context.
      </p>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api.js";

const router = useRouter();
const generating = ref(false);
const error = ref("");
const form = reactive({
  video_title: "",
  subject: "",
  difficulty: "auto",
  transcript: "",
});

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
</script>

<style scoped>
.wrap { max-width: 760px; }
.page-title { font-size: 34px; font-weight: 800; }
.form { display: flex; flex-direction: column; gap: 18px; margin-top: 22px; }
textarea { resize: vertical; font-family: var(--font-mono); font-size: 13px; }
</style>
