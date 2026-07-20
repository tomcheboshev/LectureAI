<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">{{ t("upload.title") }}</h1>
    <p class="text-slate-500 dark:text-slate-400 mt-1 mb-6">{{ t("upload.subtitle") }}</p>

    <div class="inline-flex rounded-xl border border-slate-200 dark:border-border-dark p-1 mb-6 bg-slate-100 dark:bg-white/5">
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        class="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition"
        :class="mode === m.id ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
        @click="mode = m.id"
      >
        <component :is="m.icon" class="w-4 h-4" /> {{ t(m.labelKey) }}
      </button>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <div class="grid sm:grid-cols-2 gap-5">
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
            {{ t("upload.fields.titleLabel") }} {{ mode !== "text" ? t("upload.fields.titleOptionalSuffix") : "" }}
          </label>
          <input v-model="form.video_title" maxlength="300" :required="mode === 'text'" :placeholder="t('upload.fields.titlePlaceholder')" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("upload.fields.subjectLabel") }}</label>
          <input v-model="form.subject" maxlength="150" :placeholder="t('upload.fields.subjectPlaceholder')" class="input-field" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("upload.fields.difficultyLabel") }}</label>
        <select v-model="form.difficulty" class="input-field">
          <option value="auto">{{ t("upload.difficulty.auto") }}</option>
          <option value="beginner">{{ t("upload.difficulty.beginner") }}</option>
          <option value="intermediate">{{ t("upload.difficulty.intermediate") }}</option>
          <option value="advanced">{{ t("upload.difficulty.advanced") }}</option>
        </select>
      </div>

      <!-- TEXT MODE -->
      <div v-if="mode === 'text'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("upload.text.label") }}</label>
        <textarea
          v-model="form.transcript"
          rows="14"
          required
          :placeholder="t('upload.text.placeholder')"
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
          <p class="text-xs font-mono text-slate-400 whitespace-nowrap">{{ t("upload.text.counter", { count: form.transcript.length.toLocaleString() }) }}</p>
        </div>
      </div>

      <!-- YOUTUBE MODE -->
      <div v-else-if="mode === 'youtube'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("upload.youtube.label") }}</label>
        <div class="relative">
          <VideoCameraIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="form.youtubeUrl" required :placeholder="t('upload.youtube.placeholder')" class="input-field pl-9" />
        </div>
        <p class="text-xs text-slate-400 mt-2">{{ t("upload.youtube.hint") }}</p>
      </div>

      <!-- FILE MODE -->
      <div v-else>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t("upload.file.label", { current: selectedFiles.length, max: maxFiles }) }}
          </label>
          <p v-if="selectedFiles.length > 1" class="text-xs text-slate-400">{{ t("upload.file.splitHint") }}</p>
        </div>

        <label
          class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition"
          :class="[dragging ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-border-dark hover:border-slate-300', selectedFiles.length >= maxFiles ? 'opacity-50 pointer-events-none' : '']"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onFileDrop"
        >
          <ArrowUpTrayIcon class="w-7 h-7 text-slate-400" />
          <span class="text-sm text-slate-500 dark:text-slate-400">{{ t("upload.file.dropzoneText") }}</span>
          <span class="text-xs text-slate-400">{{ t("upload.file.dropzoneHint", { max: maxFiles, size: maxFileSizeMB }) }}</span>
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
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" :title="f.file.name">{{ f.file.name }}</p>
              <p class="text-xs text-slate-400">{{ formatSize(f.file.size) }}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" :title="t('upload.file.moveUp')" :disabled="i === 0" class="icon-btn" @click="moveFile(i, -1)">
                <ChevronUpIcon class="w-4 h-4" />
              </button>
              <button type="button" :title="t('upload.file.moveDown')" :disabled="i === selectedFiles.length - 1" class="icon-btn" @click="moveFile(i, 1)">
                <ChevronDownIcon class="w-4 h-4" />
              </button>
              <button type="button" :title="t('upload.file.remove')" class="icon-btn hover:text-danger" @click="removeFile(i)">
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
          </li>
        </ul>

        <div v-if="generating && uploadProgress > 0" class="mt-3">
          <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <p class="text-xs text-slate-400 mt-1">{{ t("upload.file.uploading", { percent: uploadProgress }) }}</p>
        </div>
      </div>

      <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-3">{{ error }}</div>

      <button :disabled="generating || !canSubmit" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition">
        <SparklesIcon class="w-5 h-5" /> {{ t("upload.submit") }}
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
        <h2 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">{{ t("upload.generatingOverlay.title") }}</h2>
        <p class="text-slate-500 dark:text-slate-400 max-w-sm">{{ t("upload.generatingOverlay.description") }}</p>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from "vue";
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
import { reportApiError } from "../composables/useApiError.js";
import { useAuthStore } from "../stores/auth.js";
import { useI18n } from "../composables/useI18n.js";

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const generating = ref(false);
const error = ref("");
const dragging = ref(false);
const mode = ref("text");
const maxFiles = computed(() => auth.limits?.maxFilesPerPackage || 3);
const maxFileSizeMB = computed(() => auth.limits?.maxFileSizeMB || 25);
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
  { id: "text", labelKey: "upload.modes.text", icon: DocumentTextIcon },
  { id: "youtube", labelKey: "upload.modes.youtube", icon: VideoCameraIcon },
  { id: "file", labelKey: "upload.modes.file", icon: ArrowUpTrayIcon },
];

const form = reactive({ video_title: "", subject: "", difficulty: "auto", transcript: "", youtubeUrl: "" });

const pct = computed(() => Math.min(100, (form.transcript.length / 400000) * 100));
const tooLong = computed(() => form.transcript.length > 400000);

const canSubmit = computed(() => {
  if (mode.value === "text") return form.transcript.trim().length >= 50 && !tooLong.value;
  if (mode.value === "youtube") return form.youtubeUrl.trim().length > 10;
  return selectedFiles.value.length > 0;
});

async function submit() {
  // The submit button is disabled while generating, but that's a rendered
  // attribute — a fast double Enter-press (or a duplicate submit event) can
  // fire before Vue re-renders it. Guarding synchronously here is what
  // actually prevents a duplicate in-flight request.
  if (generating.value) return;
  error.value = "";
  generating.value = true;
  try {
    let queued;
    if (mode.value === "text") {
      queued = await api.generate({
        video_title: form.video_title,
        subject: form.subject,
        difficulty: form.difficulty,
        transcript: form.transcript,
      });
    } else if (mode.value === "youtube") {
      queued = await api.generateFromYoutube({
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
      queued = await api.generateFromFiles(fd, (evt) => {
        if (evt.total) uploadProgress.value = Math.round((evt.loaded / evt.total) * 100);
      });
    }
    router.push(`/package/${queued._id}`);
  } catch (e) {
    error.value = e.message;
    reportApiError(e);
  } finally {
    generating.value = false;
    uploadProgress.value = 0;
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

  const maxBytes = maxFileSizeMB.value * 1024 * 1024;
  const tooBig = incoming.filter((f) => f.size > maxBytes);
  const sized = incoming.filter((f) => f.size <= maxBytes);

  const room = maxFiles.value - selectedFiles.value.length;
  if (room <= 0) {
    error.value = t("upload.errors.tooManyFiles", { max: maxFiles.value });
    return;
  }
  const accepted = sized.slice(0, room);
  for (const file of accepted) {
    selectedFiles.value.push({ id: ++fileIdSeq, file });
  }

  if (tooBig.length) {
    error.value = t("upload.errors.tooBig", { files: tooBig.map((f) => f.name).join(", "), size: maxFileSizeMB.value });
  } else if (sized.length > accepted.length) {
    error.value = t("upload.errors.roomLimited", { room, max: maxFiles.value });
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
