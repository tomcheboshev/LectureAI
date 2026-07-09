<template>
  <div class="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-white/5 px-4 py-3.5">
    <span v-for="i in 3" :key="i" class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" :style="{ animationDelay: `${i * 0.12}s` }"></span>
  </div>
</template>
