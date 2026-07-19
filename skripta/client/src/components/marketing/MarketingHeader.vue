<template>
  <header class="sticky top-0 z-30 border-b border-slate-200/70 dark:border-border-dark bg-slate-50/80 dark:bg-canvas-dark/80 backdrop-blur">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2">
        <span class="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-sm">L</span>
        <span class="font-display font-bold text-lg">LectureAI</span>
      </RouterLink>
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
        <RouterLink to="/features" class="hover:text-primary transition">{{ t("marketing.nav.features") }}</RouterLink>
        <RouterLink to="/pricing" class="hover:text-primary transition">{{ t("marketing.nav.pricing") }}</RouterLink>
        <RouterLink to="/blog" class="hover:text-primary transition">{{ t("marketing.nav.blog") }}</RouterLink>
        <RouterLink to="/faq" class="hover:text-primary transition">{{ t("marketing.nav.faq") }}</RouterLink>
        <RouterLink to="/about" class="hover:text-primary transition">{{ t("marketing.nav.about") }}</RouterLink>
      </nav>
      <div class="flex items-center gap-2">
        <button
          class="md:hidden p-2 -mr-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          :aria-label="t('landing.nav.menu')"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <Bars3Icon class="w-6 h-6" />
        </button>
        <button class="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary-hover transition" @click="router.push('/dashboard')">
          {{ t("landing.nav.openApp") }} <ArrowRightIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <nav v-if="mobileNavOpen" class="md:hidden flex flex-col border-t border-slate-200/70 dark:border-border-dark px-6 py-3 gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
      <RouterLink to="/features" class="hover:text-primary transition" @click="mobileNavOpen = false">{{ t("marketing.nav.features") }}</RouterLink>
      <RouterLink to="/pricing" class="hover:text-primary transition" @click="mobileNavOpen = false">{{ t("marketing.nav.pricing") }}</RouterLink>
      <RouterLink to="/blog" class="hover:text-primary transition" @click="mobileNavOpen = false">{{ t("marketing.nav.blog") }}</RouterLink>
      <RouterLink to="/faq" class="hover:text-primary transition" @click="mobileNavOpen = false">{{ t("marketing.nav.faq") }}</RouterLink>
      <RouterLink to="/about" class="hover:text-primary transition" @click="mobileNavOpen = false">{{ t("marketing.nav.about") }}</RouterLink>
      <RouterLink to="/dashboard" class="hover:text-primary transition font-semibold" @click="mobileNavOpen = false">{{ t("landing.nav.openApp") }}</RouterLink>
    </nav>
  </header>
</template>

<script setup>
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { Bars3Icon, ArrowRightIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../../composables/useI18n.js";
import { organizationSchema, websiteSchema } from "../../seo/schema.js";

const router = useRouter();
const { t } = useI18n();
const mobileNavOpen = ref(false);

// Site-wide Organization + WebSite JSON-LD — every page that renders this
// shared header gets it once, rather than each of the 9 marketing pages
// repeating the same two schema blocks individually.
useHead({
  script: [organizationSchema(), websiteSchema()].map((schema) => ({ type: "application/ld+json", innerHTML: JSON.stringify(schema) })),
});
</script>
