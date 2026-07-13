<template>
  <template v-for="(seg, i) in segments" :key="i">
    <MermaidDiagram v-if="seg.type === 'mermaid'" :code="seg.content" />
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
