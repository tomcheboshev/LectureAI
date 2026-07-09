<template>
  <div class="deck">
    <p class="muted mono">Card {{ index + 1 }} / {{ cards.length }} · {{ current.category }}</p>
    <button class="cardface" :class="{ flipped }" @click="flipped = !flipped" :aria-label="flipped ? 'Show front' : 'Show back'">
      <div class="inner">
        <div class="face front">
          <span class="side-label">FRONT</span>
          <p>{{ current.front }}</p>
          <span class="muted hint">tap to flip</span>
        </div>
        <div class="face back">
          <span class="side-label">BACK</span>
          <p>{{ current.back }}</p>
        </div>
      </div>
    </button>
    <div class="controls">
      <button class="ghost" @click="move(-1)" :disabled="index === 0">← Prev</button>
      <button class="ghost" @click="shuffle">Shuffle</button>
      <button @click="move(1)" :disabled="index === cards.length - 1">Next →</button>
    </div>
    <div class="dots">
      <span v-for="(_, i) in cards" :key="i" class="dot" :class="{ active: i === index }"></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({ flashcards: { type: Array, required: true } });

const order = ref(props.flashcards.map((_, i) => i));
const index = ref(0);
const flipped = ref(false);

const cards = computed(() => order.value.map((i) => props.flashcards[i]));
const current = computed(() => cards.value[index.value]);

function move(step) {
  index.value = Math.min(Math.max(index.value + step, 0), cards.value.length - 1);
  flipped.value = false;
}
function shuffle() {
  order.value = [...order.value].sort(() => Math.random() - 0.5);
  index.value = 0;
  flipped.value = false;
}
</script>

<style scoped>
.deck { max-width: 560px; margin: 0 auto; text-align: center; }
.cardface {
  all: unset;
  cursor: pointer;
  display: block;
  width: 100%;
  perspective: 1200px;
  margin: 8px 0 18px;
}
.cardface:focus-visible { outline: 3px solid var(--hl); outline-offset: 3px; border-radius: var(--radius); }
.inner {
  position: relative;
  width: 100%;
  min-height: 220px;
  transition: transform 0.45s;
  transform-style: preserve-3d;
}
.cardface.flipped .inner { transform: rotateY(180deg); }
.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  background: var(--card);
  border: 1.5px solid var(--ink);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 26px;
  font-size: 17px;
  box-shadow: 4px 4px 0 var(--hl);
}
.face.back { transform: rotateY(180deg); background: var(--hl-soft); }
.side-label {
  position: absolute;
  top: 12px;
  left: 14px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.1em;
}
.hint { position: absolute; bottom: 12px; font-size: 12px; }
.controls { display: flex; gap: 10px; justify-content: center; }
.dots { display: flex; gap: 6px; justify-content: center; margin-top: 16px; }
.dot { width: 6px; height: 6px; border-radius: 999px; background: var(--line); transition: background 0.15s ease, transform 0.15s ease; }
.dot.active { background: var(--hl); transform: scale(1.4); }
@media (prefers-reduced-motion: reduce) { .inner { transition: none; } }
</style>
