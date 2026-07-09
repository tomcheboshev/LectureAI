<template>
  <div class="text-center py-16 px-6">
    <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-lg shadow-primary/25">
      <component :is="icon" class="w-7 h-7" />
    </div>
    <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-1">{{ title }}</h3>
    <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], required: true },
  title: String,
  description: String,
});
</script>
