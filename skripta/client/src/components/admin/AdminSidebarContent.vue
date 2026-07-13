<template>
  <RouterLink to="/admin" class="flex items-center gap-2 px-2 mb-6" @click="$emit('navigate')">
    <span class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-sm shadow-md shadow-primary/30">L</span>
    <span class="font-display font-bold text-lg text-slate-900 dark:text-white">{{ t("admin.nav.title") }}</span>
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
  </nav>

  <div class="mt-auto pt-6">
    <RouterLink to="/dashboard" class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition">
      <ArrowLeftIcon class="w-4 h-4" /> {{ t("admin.nav.backToApp") }}
    </RouterLink>
  </div>
</template>

<script setup>
import { useRoute, RouterLink } from "vue-router";
import {
  ArrowLeftIcon,
  ChartBarIcon,
  UsersIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  DocumentTextIcon,
  QueueListIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  LifebuoyIcon,
  EnvelopeIcon,
  TicketIcon,
  ArrowDownTrayIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "../../composables/useI18n.js";

defineEmits(["navigate"]);
const route = useRoute();
const { t } = useI18n();

const nav = [
  { to: "/admin", labelKey: "admin.nav.overview", icon: ChartBarIcon },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: UsersIcon },
  { to: "/admin/revenue", labelKey: "admin.nav.revenue", icon: CurrencyDollarIcon },
  { to: "/admin/ai-usage", labelKey: "admin.nav.aiUsage", icon: SparklesIcon },
  { to: "/admin/generation", labelKey: "admin.nav.generation", icon: DocumentTextIcon },
  { to: "/admin/queue", labelKey: "admin.nav.queue", icon: QueueListIcon },
  { to: "/admin/errors", labelKey: "admin.nav.errors", icon: ExclamationTriangleIcon },
  { to: "/admin/health", labelKey: "admin.nav.health", icon: HeartIcon },
  { to: "/admin/support", labelKey: "admin.nav.support", icon: LifebuoyIcon },
  { to: "/admin/contact", labelKey: "admin.nav.contact", icon: EnvelopeIcon },
  { to: "/admin/coupons", labelKey: "admin.nav.coupons", icon: TicketIcon },
  { to: "/admin/reports", labelKey: "admin.nav.reports", icon: ArrowDownTrayIcon },
];

function isActive(item) {
  return route.path === item.to || (item.to === "/admin/users" && route.path.startsWith("/admin/users/"));
}
</script>
