<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-1">Settings</h1>
    <p class="text-slate-500 dark:text-slate-400 mb-8">LectureAI doesn't have user accounts — settings here apply to this browser.</p>

    <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 mb-5">
      <h3 class="font-display font-bold mb-1">Appearance</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose how LectureAI looks on this device.</p>
      <div class="flex gap-2">
        <button
          class="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="!theme.dark ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="theme.apply(false)"
        >
          <SunIcon class="w-5 h-5" /> Light
        </button>
        <button
          class="flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition"
          :class="theme.dark ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300 hover:border-slate-300'"
          @click="theme.apply(true)"
        >
          <MoonIcon class="w-5 h-5" /> Dark
        </button>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 text-sm text-slate-500 dark:text-slate-400">
      <h3 class="font-display font-bold text-slate-900 dark:text-white mb-1">About</h3>
      <p>LectureAI turns lecture transcripts into study packages using Gemini. Since there's no login system yet, notifications, language and account management aren't applicable — they'll land once accounts exist.</p>
    </div>
  </div>
</template>

<script setup>
import { SunIcon, MoonIcon } from "@heroicons/vue/24/outline";
import { useThemeStore } from "../stores/theme.js";

const theme = useThemeStore();
</script>
