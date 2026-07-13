<template>
  <div class="group relative flex flex-col rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark overflow-hidden transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-none hover:border-primary/40">
    <div ref="menuRef">
      <button
        class="absolute top-2.5 right-2.5 z-10 w-8 h-8 inline-flex items-center justify-center rounded-lg bg-white/90 dark:bg-surface-dark/90 backdrop-blur text-slate-500 hover:text-slate-800 dark:hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40 transition"
        :aria-label="t('packageCard.menu')"
        :disabled="busy"
        @click.stop.prevent="menuOpen = !menuOpen"
      >
        <EllipsisVerticalIcon class="w-5 h-5" />
      </button>
      <Transition name="fade">
        <div v-if="menuOpen" class="absolute top-11 right-2.5 z-20 w-44 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-lg py-1.5" @click.stop.prevent>
          <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="startRename">
            <PencilIcon class="w-4 h-4" /> {{ t("common.rename") }}
          </button>
          <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition disabled:opacity-40" :disabled="busy || (pkg.status && pkg.status !== 'completed')" @click="duplicate">
            <DocumentDuplicateIcon class="w-4 h-4" /> {{ t("common.duplicate") }}
          </button>
          <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition disabled:opacity-40" :disabled="busy || (pkg.status && pkg.status !== 'completed')" @click="exportAs('md')">
            <ArrowDownTrayIcon class="w-4 h-4" /> {{ t("packageCard.exportMarkdown") }}
          </button>
          <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition disabled:opacity-40" :disabled="busy || (pkg.status && pkg.status !== 'completed')" @click="exportAs('json')">
            <ArrowDownTrayIcon class="w-4 h-4" /> {{ t("packageCard.exportJson") }}
          </button>
          <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm text-danger hover:bg-danger/5 transition disabled:opacity-40" :disabled="busy" @click="menuOpen = false; confirmDelete = true">
            <TrashIcon class="w-4 h-4" /> {{ t("common.delete") }}
          </button>
        </div>
      </Transition>
    </div>

    <RouterLink :to="`/package/${pkg._id}`" class="flex flex-col flex-1" @click="renaming ? $event.preventDefault() : null">
      <img v-if="pkg.source?.type === 'youtube' && pkg.source.thumbnail" :src="pkg.source.thumbnail" alt="" class="w-full aspect-video object-cover" />

      <div class="flex flex-col flex-1 p-5">
        <div class="flex items-start justify-between gap-2 mb-3">
          <span class="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 truncate max-w-[70%]">
            {{ pkg.metadata?.subject || t("packageCard.generalSubject") }}
          </span>
          <span class="text-xs font-mono text-slate-400 whitespace-nowrap pt-1">{{ formatDate(pkg.createdAt) }}</span>
        </div>

        <span v-if="pkg.status === 'failed'" class="badge badge-danger self-start mb-1.5">{{ t("packageCard.generationFailed") }}</span>
        <span v-else-if="pkg.status && pkg.status !== 'completed'" class="badge badge-primary self-start mb-1.5">
          <ArrowPathIcon class="w-3 h-3 mr-1 animate-spin" /> {{ t("packageCard.generatingLabel", { percent: pkg.progress || 0 }) }}
        </span>

        <input
          v-if="renaming"
          ref="renameInput"
          v-model="renameValue"
          class="input-field text-sm font-bold mb-1.5 py-1"
          @click.stop.prevent
          @keydown.enter="saveRename"
          @keydown.esc="renaming = false"
          @blur="saveRename"
        />
        <h3 v-else class="font-display font-bold text-slate-900 dark:text-white mb-1.5 line-clamp-2">
          {{ pkg.metadata?.video_title || t("packageCard.untitledLecture") }}
        </h3>

        <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
          {{ pkg.metadata?.short_description }}
        </p>
        <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-border-dark pt-3">
          <span v-if="sourceIcon" class="inline-flex items-center gap-1" :title="pkg.source.type">
            <component :is="sourceIcon" class="w-4 h-4" />
          </span>
          <span v-if="pkg.sources?.length > 1" class="inline-flex items-center gap-1" :title="pkg.sources.map((s) => s.filename).join(', ')">
            <DocumentDuplicateIcon class="w-4 h-4" /> {{ t("studyPackage.header.sourceCount", { count: pkg.sources.length }) }}
          </span>
          <span class="inline-flex items-center gap-1"><QuestionMarkCircleIcon class="w-4 h-4" /> {{ t("packageCard.quizCount", { count: pkg.quizCount }) }}</span>
          <span class="inline-flex items-center gap-1"><Squares2X2Icon class="w-4 h-4" /> {{ t("packageCard.flashcardCount", { count: pkg.flashcardCount }) }}</span>
          <span class="ml-auto capitalize">{{ pkg.metadata?.estimated_level }}</span>
        </div>
      </div>
    </RouterLink>

    <Modal :open="confirmDelete" :title="t('studyPackage.deleteModal.title')" :confirm-label="t('common.delete')" @close="confirmDelete = false" @confirm="doDelete">
      {{ t("common.cannotBeUndone") }}
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref, nextTick } from "vue";
import { RouterLink } from "vue-router";
import {
  QuestionMarkCircleIcon, Squares2X2Icon, VideoCameraIcon, DocumentIcon, DocumentDuplicateIcon,
  EllipsisVerticalIcon, PencilIcon, ArrowDownTrayIcon, TrashIcon, ArrowPathIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { useAuthStore } from "../stores/auth.js";
import { reportApiError } from "../composables/useApiError.js";
import { downloadMarkdown, downloadJson } from "../composables/useExport.js";
import { useI18n } from "../composables/useI18n.js";
import { useClickOutside } from "../composables/useClickOutside.js";
import Modal from "./ui/Modal.vue";

const props = defineProps({ pkg: { type: Object, required: true } });
const emit = defineEmits(["refresh"]);
const toast = useToastStore();
const auth = useAuthStore();
const { t } = useI18n();

const menuRef = ref(null);
const menuOpen = ref(false);
useClickOutside(menuRef, () => (menuOpen.value = false));
const renaming = ref(false);
const renameValue = ref("");
const renameInput = ref(null);
const confirmDelete = ref(false);
const busy = ref(false);

const sourceIcon = computed(() => {
  const type = props.pkg.source?.type;
  if (type === "youtube") return VideoCameraIcon;
  if (type && type !== "transcript" && type !== "mixed") return DocumentIcon;
  return null;
});

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

async function startRename() {
  menuOpen.value = false;
  renameValue.value = props.pkg.metadata?.video_title || "";
  renaming.value = true;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

async function saveRename() {
  if (!renaming.value) return;
  renaming.value = false;
  const title = renameValue.value.trim();
  if (!title || title === props.pkg.metadata?.video_title) return;
  try {
    await api.renamePackage(props.pkg._id, title);
    toast.success(t("toasts.renamed"));
    emit("refresh");
  } catch (e) {
    reportApiError(e);
  }
}

async function duplicate() {
  if (busy.value) return;
  menuOpen.value = false;
  busy.value = true;
  try {
    await api.duplicatePackage(props.pkg._id);
    toast.success(t("toasts.duplicated"));
    emit("refresh");
  } catch (e) {
    reportApiError(e);
  } finally {
    busy.value = false;
  }
}

async function exportAs(format) {
  if (busy.value) return;
  menuOpen.value = false;
  busy.value = true;
  try {
    const full = await api.getPackage(props.pkg._id);
    if (format === "md") downloadMarkdown(full, { watermark: !auth.isPro });
    else downloadJson(full);
  } catch (e) {
    reportApiError(e);
  } finally {
    busy.value = false;
  }
}

async function doDelete() {
  if (busy.value) return;
  confirmDelete.value = false;
  busy.value = true;
  try {
    await api.deletePackage(props.pkg._id);
    toast.success(t("toasts.packageDeleted"));
    emit("refresh");
  } catch (e) {
    reportApiError(e);
  } finally {
    busy.value = false;
  }
}
</script>
