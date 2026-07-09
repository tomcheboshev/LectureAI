<template>
  <RouterLink
    :to="`/package/${pkg._id}`"
    class="group flex flex-col rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark overflow-hidden transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-none hover:border-primary/40"
  >
    <img v-if="pkg.source?.type === 'youtube' && pkg.source.thumbnail" :src="pkg.source.thumbnail" alt="" class="w-full aspect-video object-cover" />

    <div class="flex flex-col flex-1 p-5">
      <div class="flex items-start justify-between gap-2 mb-3">
        <span class="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 truncate max-w-[70%]">
          {{ pkg.metadata?.subject || "General" }}
        </span>
        <span class="text-xs font-mono text-slate-400 whitespace-nowrap pt-1">{{ formatDate(pkg.createdAt) }}</span>
      </div>
      <h3 class="font-display font-bold text-slate-900 dark:text-white mb-1.5 line-clamp-2">
        {{ pkg.metadata?.video_title || "Untitled lecture" }}
      </h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
        {{ pkg.metadata?.short_description }}
      </p>
      <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-border-dark pt-3">
        <span v-if="sourceIcon" class="inline-flex items-center gap-1" :title="pkg.source.type">
          <component :is="sourceIcon" class="w-4 h-4" />
        </span>
        <span v-if="pkg.sources?.length > 1" class="inline-flex items-center gap-1" :title="pkg.sources.map((s) => s.filename).join(', ')">
          <DocumentDuplicateIcon class="w-4 h-4" /> {{ pkg.sources.length }} sources
        </span>
        <span class="inline-flex items-center gap-1"><QuestionMarkCircleIcon class="w-4 h-4" /> {{ pkg.quizCount }} quiz</span>
        <span class="inline-flex items-center gap-1"><Squares2X2Icon class="w-4 h-4" /> {{ pkg.flashcardCount }} cards</span>
        <span class="ml-auto capitalize">{{ pkg.metadata?.estimated_level }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { QuestionMarkCircleIcon, Squares2X2Icon, VideoCameraIcon, DocumentIcon, DocumentDuplicateIcon } from "@heroicons/vue/24/outline";

const props = defineProps({ pkg: { type: Object, required: true } });

const sourceIcon = computed(() => {
  const type = props.pkg.source?.type;
  if (type === "youtube") return VideoCameraIcon;
  if (type && type !== "transcript" && type !== "mixed") return DocumentIcon;
  return null;
});

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
</script>
