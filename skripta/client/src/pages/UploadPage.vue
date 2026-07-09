<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">New study package</h1>
    <p class="text-slate-500 dark:text-slate-400 mt-1 mb-6">Paste a transcript, drop in a YouTube link, or upload up to 10 files (PDF, PPTX, DOCX, TXT, MD, SRT, VTT, PNG, JPG).</p>

    <div class="inline-flex rounded-xl border border-slate-200 dark:border-border-dark p-1 mb-6 bg-slate-100 dark:bg-white/5">
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
        :class="mode === m.id ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        @click="mode = m.id"
      >
        <component :is="m.icon" class="w-4 h-4" /> {{ m.label }}
      </button>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
            Lecture title {{ mode !== "text" ? "(optional — auto-detected)" : "" }}
          </label>
          <input v-model="form.video_title" maxlength="300" :required="mode === 'text'" placeholder="e.g. Turing Machines — Lecture 7" class="input-field" />
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

      <!-- TEXT MODE -->
      <div v-if="mode === 'text'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Raw transcript</label>
        <textarea
          v-model="form.transcript"
          rows="14"
          required
          placeholder="Paste the full transcript here… or drag & drop a .txt file"
          class="input-field font-mono text-sm resize-y transition"
          :class="dragging ? 'border-primary bg-primary/5' : ''"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onTextDrop"
        ></textarea>
        <div class="flex items-center gap-3 mt-2">
          <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full transition-all" :class="tooLong ? 'bg-danger' : 'bg-primary'" :style="{ width: pct + '%' }"></div>
          </div>
          <p class="text-xs font-mono text-slate-400 whitespace-nowrap">{{ form.transcript.length.toLocaleString() }} / 400,000</p>
        </div>
      </div>

      <!-- YOUTUBE MODE -->
      <div v-else-if="mode === 'youtube'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">YouTube video URL</label>
        <div class="relative">
          <VideoCameraIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="form.youtubeUrl" required placeholder="https://www.youtube.com/watch?v=…" class="input-field pl-9" />
        </div>
        <p class="text-xs text-slate-400 mt-2">The video needs captions/subtitles available (auto-generated captions work too).</p>
      </div>

      <!-- FILE MODE -->
      <div v-else>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Files ({{ selectedFiles.length }}/{{ maxFiles }})
          </label>
          <p v-if="selectedFiles.length > 1" class="text-xs text-slate-400">Summary stays split by document; everything else is merged.</p>
        </div>

        <label
          class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition"
          :class="[dragging ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-border-dark hover:border-slate-300', selectedFiles.length >= maxFiles ? 'opacity-50 pointer-events-none' : '']"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onFileDrop"
        >
          <ArrowUpTrayIcon class="w-7 h-7 text-slate-400" />
          <span class="text-sm text-slate-500 dark:text-slate-400">Drag & drop files here, or click to browse</span>
          <span class="text-xs text-slate-400">PDF, PPTX, DOCX, TXT, MD, SRT, VTT, PNG, JPG · up to {{ maxFiles }} files</span>
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.docx,.txt,.md,.srt,.vtt,.png,.jpg,.jpeg"
            class="sr-only"
            @change="onFileInput"
          />
        </label>

        <ul v-if="selectedFiles.length" class="mt-3 flex flex-col gap-2">
          <li
            v-for="(f, i) in selectedFiles"
            :key="f.id"
            class="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5"
          >
            <component :is="fileIcon(f.file)" class="w-5 h-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{{ f.file.name }}</p>
              <p class="text-xs text-slate-400">{{ formatSize(f.file.size) }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" title="Move up" :disabled="i === 0" class="icon-btn" @click="moveFile(i, -1)">
                <ChevronUpIcon class="w-4 h-4" />
              </button>
              <button type="button" title="Move down" :disabled="i === selectedFiles.length - 1" class="icon-btn" @click="moveFile(i, 1)">
                <ChevronDownIcon class="w-4 h-4" />
              </button>
              <button type="button" title="Remove" class="icon-btn hover:text-danger" @click="removeFile(i)">
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
          </li>
        </ul>

        <div v-if="generating && uploadProgress > 0" class="mt-3">
          <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <p class="text-xs text-slate-400 mt-1">Uploading… {{ uploadProgress }}%</p>
        </div>
      </div>

      <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-3">{{ error }}</div>

      <button :disabled="generating || !canSubmit" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition">
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
import {
  SparklesIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";

const router = useRouter();
const toast = useToastStore();
const generating = ref(false);
const error = ref("");
const dragging = ref(false);
const mode = ref("text");
const maxFiles = 10;
const selectedFiles = ref([]);
const uploadProgress = ref(0);
let fileIdSeq = 0;

const ICONS_BY_EXT = {
  pdf: DocumentTextIcon,
  docx: DocumentTextIcon,
  txt: DocumentIcon,
  md: DocumentIcon,
  pptx: PresentationChartBarIcon,
  srt: VideoCameraIcon,
  vtt: VideoCameraIcon,
  png: PhotoIcon,
  jpg: PhotoIcon,
  jpeg: PhotoIcon,
};
function fileIcon(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ICONS_BY_EXT[ext] || DocumentIcon;
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const modes = [
  { id: "text", label: "Paste transcript", icon: DocumentTextIcon },
  { id: "youtube", label: "YouTube URL", icon: VideoCameraIcon },
  { id: "file", label: "Upload file", icon: ArrowUpTrayIcon },
];

const form = reactive({ video_title: "", subject: "", difficulty: "auto", transcript: "", youtubeUrl: "" });

const pct = computed(() => Math.min(100, (form.transcript.length / 400000) * 100));
const tooLong = computed(() => form.transcript.length > 400000);

const canSubmit = computed(() => {
  if (mode.value === "text") return form.transcript.trim().length >= 50 && !tooLong.value;
  if (mode.value === "youtube") return form.youtubeUrl.trim().length > 10;
  return selectedFiles.value.length > 0;
});

const statusMessages = [
  "Reading the source…",
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
    let doc;
    if (mode.value === "text") {
      doc = await api.generate({
        video_title: form.video_title,
        subject: form.subject,
        difficulty: form.difficulty,
        transcript: form.transcript,
      });
    } else if (mode.value === "youtube") {
      doc = await api.generateFromYoutube({
        url: form.youtubeUrl,
        video_title: form.video_title || undefined,
        subject: form.subject,
        difficulty: form.difficulty,
      });
    } else {
      const fd = new FormData();
      for (const f of selectedFiles.value) fd.append("files", f.file);
      if (form.video_title) fd.append("video_title", form.video_title);
      if (form.subject) fd.append("subject", form.subject);
      fd.append("difficulty", form.difficulty);
      uploadProgress.value = 0;
      doc = await api.generateFromFiles(fd, (evt) => {
        if (evt.total) uploadProgress.value = Math.round((evt.loaded / evt.total) * 100);
      });
    }
    toast.success("Study package generated.");
    router.push(`/package/${doc._id}`);
  } catch (e) {
    error.value = e.message;
    toast.error(e.message);
  } finally {
    generating.value = false;
    uploadProgress.value = 0;
    stopStatusRotation();
  }
}

function readTextFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { form.transcript = String(reader.result || ""); };
  reader.readAsText(file);
}
function onTextDrop(e) {
  dragging.value = false;
  readTextFile(e.dataTransfer?.files?.[0]);
}
function addFiles(fileList) {
  if (!fileList) return;
  const incoming = Array.from(fileList);
  const room = maxFiles - selectedFiles.value.length;
  if (room <= 0) {
    error.value = `You can upload at most ${maxFiles} files at once.`;
    return;
  }
  const accepted = incoming.slice(0, room);
  for (const file of accepted) {
    selectedFiles.value.push({ id: ++fileIdSeq, file });
  }
  if (incoming.length > accepted.length) {
    error.value = `Only ${room} more file(s) could be added — the ${maxFiles}-file limit was reached.`;
  } else {
    error.value = "";
  }
}
function onFileInput(e) {
  addFiles(e.target.files);
  e.target.value = "";
}
function onFileDrop(e) {
  dragging.value = false;
  addFiles(e.dataTransfer?.files);
}
function removeFile(index) {
  selectedFiles.value.splice(index, 1);
}
function moveFile(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= selectedFiles.value.length) return;
  const arr = selectedFiles.value;
  [arr[index], arr[target]] = [arr[target], arr[index]];
}
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
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  color: rgb(100 116 139);
  transition: background 0.15s ease, color 0.15s ease;
}
.icon-btn:hover:not(:disabled) { background: rgb(241 245 249); color: rgb(51 65 85); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
:global(html.dark .icon-btn:hover:not(:disabled)) { background: rgba(255, 255, 255, 0.08); color: white; }
</style>
