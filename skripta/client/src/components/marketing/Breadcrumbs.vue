<template>
  <nav :aria-label="marketing.breadcrumbHome" class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mb-2">
    <template v-for="(item, i) in items" :key="item.path">
      <RouterLink v-if="i < items.length - 1" :to="item.path" class="hover:text-primary transition">{{ item.label }}</RouterLink>
      <span v-else class="text-slate-700 dark:text-slate-200 font-medium">{{ item.label }}</span>
      <ChevronRightIcon v-if="i < items.length - 1" class="w-3.5 h-3.5 shrink-0" />
    </template>
  </nav>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { ChevronRightIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../../composables/useI18n.js";

defineProps({
  // [{ label, path }] — the very same array the caller also passes to
  // breadcrumbListSchema(items) so the visible UI and the JSON-LD can never
  // disagree with each other.
  items: { type: Array, required: true },
});

const { t: marketing } = useI18n();
</script>
