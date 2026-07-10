<template>
  <div class="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-slate-50 dark:bg-canvas-dark">
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-display font-extrabold text-2xl mb-6 animate-float">
      404
    </div>
    <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white mb-2">{{ t("notFound.title") }}</h1>
    <p class="text-slate-500 dark:text-slate-400 max-w-sm mb-8">{{ t("notFound.description") }}</p>
    <RouterLink to="/dashboard" class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover transition">
      {{ t("notFound.backToDashboard") }}
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
</script>
