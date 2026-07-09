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

    <div ref="scrollEl" class="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5" @click="onMessageAreaClick">
      <div v-if="loadingHistory" class="flex flex-col gap-3">
        <div class="skeleton h-10 w-2/3 rounded-2xl"></div>
        <div class="skeleton h-10 w-1/2 rounded-2xl self-end"></div>
      </div>
      <div v-else-if="messages.length === 0" class="flex flex-col gap-2">
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

      <div v-for="(m, i) in messages" :key="i" class="group flex flex-col gap-1" :class="m.role === 'user' ? 'items-end' : 'items-start'">
        <div class="flex gap-3 max-w-[88%]" :class="m.role === 'user' ? 'flex-row-reverse' : ''">
          <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" :class="m.role === 'user' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-gradient-to-br from-primary to-secondary text-white'">
            {{ m.role === "user" ? "Y" : "T" }}
          </span>
          <div
            class="prose-chat text-sm rounded-2xl px-4 py-2.5"
            :class="m.role === 'user'
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-100 rounded-tl-sm'"
            v-html="renderBody(m, i)"
          ></div>
        </div>
        <div class="flex items-center gap-2 px-10 opacity-0 group-hover:opacity-100 transition" :class="m.role === 'user' ? 'flex-row-reverse pl-0 pr-10' : ''">
          <button class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1" @click="copyMessage(m.content)">
            <ClipboardDocumentIcon class="w-3.5 h-3.5" /> Copy
          </button>
          <button
            v-if="m.role === 'assistant' && i === messages.length - 1 && !thinking"
            class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 inline-flex items-center gap-1"
            @click="regenerate"
          >
            <ArrowPathIcon class="w-3.5 h-3.5" /> Regenerate
          </button>
        </div>
      </div>

      <div v-if="thinking" class="flex gap-3">
        <span class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold">T</span>
        <TypingIndicator />
      </div>
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
import { ref, onMounted, nextTick } from "vue";
import { SparklesIcon, PaperAirplaneIcon } from "@heroicons/vue/24/solid";
import { ClipboardDocumentIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { reportApiError } from "../composables/useApiError.js";
import { renderMarkdown } from "../composables/useMarkdown.js";
import TypingIndicator from "./TypingIndicator.vue";

const props = defineProps({
  packageId: { type: String, required: true },
  suggestedPrompts: { type: Array, default: () => [] },
});

const toast = useToastStore();
const messages = ref([]);
const draft = ref("");
const thinking = ref(false);
const loadingHistory = ref(true);
const scrollEl = ref(null);

// While a reply is being "typed out", we render a plain-text reveal instead
// of the full markdown — animating partial markdown risks rendering broken
// HTML mid-fence (e.g. inside an unclosed code block).
const typingIndex = ref(-1);
const typingRevealed = ref("");

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderBody(m, i) {
  if (m.role === "assistant" && i === typingIndex.value) {
    return escapeHtml(typingRevealed.value).replace(/\n/g, "<br>") + '<span class="typing-cursor">▍</span>';
  }
  return renderMarkdown(m.content);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function animateTyping(index, fullText) {
  typingIndex.value = index;
  typingRevealed.value = "";
  const chunk = Math.max(2, Math.round(fullText.length / 120));
  for (let i = 0; i < fullText.length; i += chunk) {
    typingRevealed.value = fullText.slice(0, i + chunk);
    scrollDown();
    await sleep(10);
  }
  typingIndex.value = -1;
}

onMounted(async () => {
  try {
    const { messages: history } = await api.getChatHistory(props.packageId);
    messages.value = history;
    if (history.length) scrollDown();
  } catch {
    // No history yet, or it failed to load — start with a blank conversation.
  } finally {
    loadingHistory.value = false;
  }
});

async function send(text) {
  const content = text.trim();
  if (!content || thinking.value) return;
  messages.value.push({ role: "user", content });
  draft.value = "";
  thinking.value = true;
  scrollDown();
  try {
    const { reply } = await api.chat(props.packageId, messages.value);
    const idx = messages.value.push({ role: "assistant", content: reply }) - 1;
    thinking.value = false;
    await animateTyping(idx, reply);
  } catch (e) {
    messages.value.pop();
    draft.value = content;
    reportApiError(e);
    thinking.value = false;
  } finally {
    scrollDown();
  }
}

async function regenerate() {
  if (thinking.value || messages.value.length === 0) return;
  const last = messages.value[messages.value.length - 1];
  if (last.role !== "assistant") return;

  const withoutLast = messages.value.slice(0, -1);
  messages.value = withoutLast;
  thinking.value = true;
  scrollDown();
  try {
    const { reply } = await api.chat(props.packageId, withoutLast);
    const idx = messages.value.push({ role: "assistant", content: reply }) - 1;
    thinking.value = false;
    await animateTyping(idx, reply);
  } catch (e) {
    messages.value.push(last);
    reportApiError(e);
    thinking.value = false;
  } finally {
    scrollDown();
  }
}

async function copyMessage(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied.");
  } catch {
    toast.error("Could not copy to clipboard.");
  }
}

function onMessageAreaClick(e) {
  const btn = e.target.closest(".code-copy-btn");
  if (!btn) return;
  const codeEl = btn.closest(".code-block")?.querySelector("code");
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent || "");
  const original = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => {
    btn.textContent = original;
  }, 1500);
}

async function clearChat() {
  const previous = messages.value;
  messages.value = [];
  try {
    await api.clearChatHistory(props.packageId);
  } catch (e) {
    messages.value = previous;
    toast.error(e.message);
  }
}

async function scrollDown() {
  await nextTick();
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: "smooth" });
}
</script>

<style scoped>
:deep(.typing-cursor) {
  display: inline-block;
  animation: blink 1s step-start infinite;
  color: var(--color-primary);
}
@keyframes blink {
  50% { opacity: 0; }
}
</style>
