<template>
  <RouterLink to="/" class="flex items-center gap-2 px-2 mb-6" @click="$emit('navigate')">
    <span class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-sm shadow-md shadow-primary/30">L</span>
    <span class="font-display font-bold text-lg text-slate-900 dark:text-white">LectureAI</span>
  </RouterLink>

  <nav class="flex flex-col gap-1">
    <RouterLink
      v-for="item in nav"
      :key="item.to"
      :to="item.to"
      class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
      :class="isActive(item) ? 'bg-primary/10 text-primary dark:bg-primary/20' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'"
      @click="$emit('navigate')"
    >
      <component :is="item.icon" class="w-5 h-5 shrink-0" />
      {{ t(item.labelKey) }}
    </RouterLink>
    <RouterLink
      v-if="auth.user?.role === 'admin'"
      to="/admin"
      class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
      @click="$emit('navigate')"
    >
      <ShieldCheckIcon class="w-5 h-5 shrink-0" />
      {{ t("nav.admin") }}
    </RouterLink>
  </nav>

  <div class="mt-auto pt-6">
    <div class="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4">
      <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{{ t("sidebar.tipLabel") }}</p>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ t("sidebar.tipBody") }}</p>
    </div>
  </div>
</template>

<script setup>
import { useRoute, RouterLink } from "vue-router";
import { HomeIcon, PlusCircleIcon, Cog6ToothIcon, ChartBarIcon, ShieldCheckIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../composables/useI18n.js";
import { useAuthStore } from "../stores/auth.js";

defineEmits(["navigate"]);
const route = useRoute();
const { t } = useI18n();
const auth = useAuthStore();

const nav = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: HomeIcon },
  { to: "/new", labelKey: "nav.newPackage", icon: PlusCircleIcon },
  { to: "/analytics", labelKey: "nav.analytics", icon: ChartBarIcon },
  { to: "/settings", labelKey: "nav.settings", icon: Cog6ToothIcon },
];

function isActive(item) {
  return route.path === item.to || (item.to === "/dashboard" && route.path.startsWith("/package/"));
}
</script>
