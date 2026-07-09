<template>
  <div class="min-h-screen flex bg-slate-50 dark:bg-canvas-dark">
    <!-- Sidebar (desktop) -->
    <aside class="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-5">
      <SidebarContent />
    </aside>

    <!-- Mobile sidebar drawer -->
    <Transition name="fade">
      <div v-if="mobileOpen" class="fixed inset-0 z-40 lg:hidden">
        <div class="absolute inset-0 bg-black/40" @click="mobileOpen = false"></div>
        <aside class="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-surface-dark px-4 py-5 shadow-xl">
          <SidebarContent @navigate="mobileOpen = false" />
        </aside>
      </div>
    </Transition>

    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Topbar -->
      <header class="sticky top-0 z-30 flex items-center gap-3 h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-border-dark bg-white/80 dark:bg-surface-dark/80 backdrop-blur">
        <button class="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" @click="mobileOpen = true">
          <Bars3Icon class="w-6 h-6" />
        </button>

        <div class="flex-1"></div>

        <button
          class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          :title="theme.dark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="theme.toggle()"
        >
          <SunIcon v-if="theme.dark" class="w-5 h-5" />
          <MoonIcon v-else class="w-5 h-5" />
        </button>
        <RouterLink to="/new" class="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary-hover transition">
          <PlusIcon class="w-4 h-4" /> New package
        </RouterLink>
      </header>

      <main class="flex-1 min-w-0">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <ToastContainer />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { Bars3Icon, SunIcon, MoonIcon, PlusIcon } from "@heroicons/vue/24/outline";
import { useThemeStore } from "../stores/theme.js";
import SidebarContent from "../components/SidebarContent.vue";
import ToastContainer from "../components/ui/ToastContainer.vue";

const theme = useThemeStore();
const mobileOpen = ref(false);
</script>
