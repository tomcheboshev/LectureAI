<template>
  <template v-for="(seg, i) in segments" :key="i">
    <MermaidDiagram v-if="seg.type === 'mermaid'" :code="seg.content" />
    <span v-else v-html="renderLatexText(seg.content)"></span>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { renderLatexText } from "../composables/useLatex.js";
import { splitMermaidSegments } from "../composables/useMermaid.js";
import MermaidDiagram from "./MermaidDiagram.vue";

const props = defineProps({ text: { type: String, default: "" } });
const segments = computed(() => splitMermaidSegments(props.text));
</script>
