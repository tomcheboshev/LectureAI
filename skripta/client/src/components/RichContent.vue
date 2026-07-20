<template>
  <template v-for="(seg, i) in segments" :key="i">
    <div v-if="seg.type === 'mermaid'" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 my-3 overflow-x-auto">
      <MermaidDiagram :code="seg.content" />
    </div>
    <div v-else class="rich-content-block" v-html="renderMarkdown(seg.content)"></div>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { renderMarkdown } from "../composables/useMarkdown.js";
import { splitMermaidSegments } from "../composables/useMermaid.js";
import MermaidDiagram from "./MermaidDiagram.vue";

const props = defineProps({ text: { type: String, default: "" } });
const segments = computed(() => splitMermaidSegments(props.text));
</script>
