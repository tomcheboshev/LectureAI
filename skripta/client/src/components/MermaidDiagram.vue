<template>
  <div v-if="svg" class="mermaid-diagram overflow-x-auto rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4 my-2" v-html="svg"></div>
  <p v-else-if="error" class="text-xs font-mono text-danger/80 bg-danger/5 rounded-lg p-3 my-2 whitespace-pre-wrap">{{ code }}</p>
  <div v-else class="skeleton h-24 rounded-xl my-2"></div>
</template>

<script setup>
import { ref, watch } from "vue";
import { renderMermaidToSvg } from "../composables/useMermaid.js";

const props = defineProps({ code: { type: String, required: true } });
const svg = ref("");
const error = ref(false);

async function render() {
  svg.value = "";
  error.value = false;
  try {
    svg.value = await renderMermaidToSvg(props.code);
  } catch (e) {
    console.error("Mermaid render failed:", e);
    error.value = true;
  }
}

watch(() => props.code, render, { immediate: true });
</script>
