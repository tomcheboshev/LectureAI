<template>
  <footer class="border-t border-slate-200 dark:border-border-dark py-10">
    <div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
      <div class="flex items-center gap-2">
        <span class="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-xs">L</span>
        <span class="font-display font-semibold text-slate-700 dark:text-slate-200">LectureAI</span>
      </div>
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <RouterLink to="/features" class="hover:text-primary transition">{{ t("marketing.nav.features") }}</RouterLink>
        <RouterLink to="/pricing" class="hover:text-primary transition">{{ t("marketing.nav.pricing") }}</RouterLink>
        <RouterLink to="/blog" class="hover:text-primary transition">{{ t("marketing.nav.blog") }}</RouterLink>
        <RouterLink to="/faq" class="hover:text-primary transition">{{ t("marketing.nav.faq") }}</RouterLink>
        <RouterLink to="/about" class="hover:text-primary transition">{{ t("marketing.nav.about") }}</RouterLink>
        <RouterLink to="/contact" class="hover:text-primary transition">{{ t("marketing.nav.contactUs") }}</RouterLink>
        <RouterLink to="/privacy" class="hover:text-primary transition">{{ t("marketing.nav.privacy") }}</RouterLink>
        <RouterLink to="/terms" class="hover:text-primary transition">{{ t("marketing.nav.terms") }}</RouterLink>
      </nav>
      <p>{{ t("landing.footer.tagline") }}</p>
    </div>
  </footer>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { useI18n } from "../../composables/useI18n.js";

const { t } = useI18n();
</script>
