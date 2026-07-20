<template>
  <div class="callout" :class="`callout-${variant}`">
    <div class="callout-icon">{{ icon }}</div>
    <div class="callout-body">
      <span class="callout-label">{{ title }}</span>
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    required: true,
    validator: (v) => ["definition", "concept", "example", "mistake", "warning", "tip", "exam", "info"].includes(v),
  },
  icon: { type: String, required: true },
  title: { type: String, required: true },
});
</script>
