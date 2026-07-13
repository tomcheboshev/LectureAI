<template>
  <div class="relative" :style="{ height: `${height}px` }">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useChart } from "../../composables/useChart.js";

const props = defineProps({
  type: { type: String, default: "line" },
  data: { type: Object, required: true },
  options: { type: Object, default: () => ({}) },
  height: { type: Number, default: 220 },
});

const canvasRef = ref(null);
const config = computed(() => ({
  type: props.type,
  data: props.data,
  options: { responsive: true, maintainAspectRatio: false, ...props.options },
}));

useChart(canvasRef, config);
</script>
