<template>
  <div class="chat card">
    <div ref="scrollEl" class="messages">
      <div v-if="messages.length === 0" class="starter">
        <div class="starter-mark">?</div>
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
        <span class="avatar" :class="m.role">{{ m.role === "user" ? "Y" : "T" }}</span>
        <div class="bubble-col">
          <span class="who mono">{{ m.role === "user" ? "you" : "tutor" }}</span>
          <p>{{ m.content }}</p>
        </div>
      </div>
      <div v-if="thinking" class="msg assistant">
        <span class="avatar assistant">T</span>
        <div class="bubble-col">
          <span class="who mono">tutor</span>
          <p class="typing"><span></span><span></span><span></span></p>
        </div>
      </div>
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
.chat { display: flex; flex-direction: column; height: 560px; padding: 0; overflow: hidden; }
.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.starter { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; padding: 8px 0 4px; }
.starter-mark {
  width: 36px; height: 36px; border-radius: 999px;
  background: var(--hl-soft); border: 1px solid var(--hl);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 800; margin-bottom: 6px;
}
.prompt { font-family: var(--font-body); font-weight: 500; font-size: 14px; text-align: left; }
.msg { display: flex; gap: 10px; max-width: 88%; }
.avatar {
  flex-shrink: 0;
  width: 28px; height: 28px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display); font-weight: 800; font-size: 12px;
}
.avatar.user { background: var(--ink); color: var(--paper); }
.avatar.assistant { background: var(--hl); color: var(--hl-ink, #1c1e26); }
.bubble-col { display: flex; flex-direction: column; min-width: 0; }
.msg p { margin: 2px 0 0; white-space: pre-wrap; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.msg.user .bubble-col { align-items: flex-end; }
.msg.user p { background: var(--hl-soft); border: 1px solid var(--hl); border-radius: 10px 10px 2px 10px; padding: 10px 12px; display: inline-block; text-align: left; }
.msg.assistant p { background: var(--card-2); border: 1px solid var(--line); border-radius: 10px 10px 10px 2px; padding: 10px 12px; display: inline-block; }
.who { font-size: 10px; color: var(--muted); letter-spacing: 0.08em; }
.bad-text { color: var(--bad); font-size: 13px; }
.inputrow { display: flex; gap: 10px; border-top: 1.5px solid var(--line); padding: 12px; background: var(--card-2); }

.typing { display: inline-flex; gap: 4px; padding: 12px 14px !important; background: var(--card-2); border: 1px solid var(--line); border-radius: 10px 10px 10px 2px; }
.typing span {
  width: 6px; height: 6px; border-radius: 50%; background: var(--muted);
  animation: bounce 1.1s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
</style>
