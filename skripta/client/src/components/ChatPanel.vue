<template>
  <div class="flex flex-col h-[600px] rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-border-dark">
      <div class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span class="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary text-white">
          <SparklesIcon class="w-4 h-4" />
        </span>
        AI Tutor
      </div>
      <button v-if="messages.length" class="text-xs font-medium text-slate-400 hover:text-danger transition" @click="clearChat">Clear chat</button>
    </div>

    <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
      <div v-if="messages.length === 0" class="flex flex-col gap-2">
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">Ask anything about this lecture. Try one of these:</p>
        <button
          v-for="p in suggestedPrompts"
          :key="p"
          class="text-left text-sm rounded-xl border border-slate-200 dark:border-border-dark px-3.5 py-2.5 hover:border-primary hover:bg-primary/5 transition"
          @click="send(p)"
        >
          {{ p }}
        </button>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="flex gap-3 max-w-[88%]" :class="m.role === 'user' ? 'self-end flex-row-reverse' : ''">
        <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" :class="m.role === 'user' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-gradient-to-br from-primary to-secondary text-white'">
          {{ m.role === "user" ? "Y" : "T" }}
        </span>
        <div
          class="prose-chat text-sm rounded-2xl px-4 py-2.5"
          :class="m.role === 'user'
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-100 rounded-tl-sm'"
          v-html="renderMarkdown(m.content)"
        ></div>
      </div>

      <div v-if="thinking" class="flex gap-3">
        <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold">T</span>
        <TypingIndicator />
      </div>

      <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    </div>

    <form class="flex gap-2 border-t border-slate-200 dark:border-border-dark p-3 bg-slate-50/60 dark:bg-white/[0.02]" @submit.prevent="send(draft)">
      <input
        v-model="draft"
        placeholder="Ask about the lecture…"
        :disabled="thinking"
        class="flex-1 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
      />
      <button :disabled="thinking || !draft.trim()" class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white disabled:opacity-40 hover:bg-primary-hover transition">
        <PaperAirplaneIcon class="w-5 h-5" />
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { SparklesIcon, PaperAirplaneIcon } from "@heroicons/vue/24/solid";
import { api } from "../services/api.js";
import { renderMarkdown } from "../composables/useMarkdown.js";
import TypingIndicator from "./TypingIndicator.vue";

const props = defineProps({
  packageId: { type: String, required: true },
  suggestedPrompts: { type: Array, default: () => [] },
});

const messages = ref([]);
const draft = ref("");
const thinking = ref(false);
const error = ref("");
const scrollEl = ref(null);

async function send(text) {
  const content = text.trim();
  if (!content || thinking.value) return;
  error.value = "";
  messages.value.push({ role: "user", content });
  draft.value = "";
  thinking.value = true;
  scrollDown();
  try {
    const { reply } = await api.chat(props.packageId, messages.value);
    messages.value.push({ role: "assistant", content: reply });
  } catch (e) {
    error.value = e.message;
    messages.value.pop();
    draft.value = content;
  } finally {
    thinking.value = false;
    scrollDown();
  }
}

function clearChat() {
  messages.value = [];
  error.value = "";
}

async function scrollDown() {
  await nextTick();
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: "smooth" });
}
</script>
