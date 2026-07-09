<template>
  <div class="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark p-5 flex items-center gap-4 transition hover:shadow-md hover:-translate-y-0.5">
    <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" :class="tint">
      <component :is="icon" class="w-5.5 h-5.5" :class="iconColor" />
    </div>
    <div class="min-w-0">
      <p class="text-2xl font-display font-bold text-slate-900 dark:text-white leading-tight">{{ value }}</p>
      <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ label }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  value: [String, Number],
  label: String,
  tint: { type: String, default: "bg-primary/10" },
  iconColor: { type: String, default: "text-primary" },
});
</script>
