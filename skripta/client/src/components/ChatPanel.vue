<template>
  <div class="chat card">
    <div ref="scrollEl" class="messages">
      <div v-if="messages.length === 0" class="starter">
        <p class="muted">Ask anything about this lecture. Try one of these:</p>
        <button
          v-for="p in suggestedPrompts"
          :key="p"
          class="ghost prompt"
          @click="send(p)"
        >
          {{ p }}
        </button>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <span class="who mono">{{ m.role === "user" ? "you" : "tutor" }}</span>
        <p>{{ m.content }}</p>
      </div>
      <p v-if="thinking" class="muted mono thinking">tutor is thinking…</p>
      <p v-if="error" class="bad-text">{{ error }}</p>
    </div>
    <form class="inputrow" @submit.prevent="send(draft)">
      <input v-model="draft" placeholder="Ask about the lecture…" :disabled="thinking" />
      <button :disabled="thinking || !draft.trim()">Send</button>
    </form>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { api } from "../api.js";

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
    messages.value.pop(); // let the user retry the failed question
    draft.value = content;
  } finally {
    thinking.value = false;
    scrollDown();
  }
}

async function scrollDown() {
  await nextTick();
  scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: "smooth" });
}
</script>

<style scoped>
.chat { display: flex; flex-direction: column; height: 520px; padding: 0; overflow: hidden; }
.messages { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.starter { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.prompt { font-family: var(--font-body); font-weight: 500; font-size: 14px; text-align: left; }
.msg { max-width: 82%; }
.msg p { margin: 2px 0 0; white-space: pre-wrap; }
.msg.user { align-self: flex-end; text-align: right; }
.msg.user p { background: var(--hl-soft); border: 1px solid var(--hl); border-radius: 10px 10px 2px 10px; padding: 10px 12px; display: inline-block; text-align: left; }
.msg.assistant p { background: #fff; border: 1px solid var(--line); border-radius: 10px 10px 10px 2px; padding: 10px 12px; display: inline-block; }
.who { font-size: 10px; color: var(--muted); letter-spacing: 0.08em; }
.thinking { margin: 0; }
.bad-text { color: var(--bad); font-size: 13px; }
.inputrow { display: flex; gap: 10px; border-top: 1.5px solid var(--line); padding: 12px; background: var(--paper); }
</style>
