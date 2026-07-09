<template>
  <div class="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-slate-50 dark:bg-canvas-dark">
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-display font-extrabold text-2xl mb-6 animate-float">
      404
    </div>
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-2">Page not found</h1>
    <p class="text-slate-500 dark:text-slate-400 max-w-sm mb-8">The page you're looking for doesn't exist or may have been moved.</p>
    <RouterLink to="/dashboard" class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover transition">
      Back to dashboard
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
</script>
