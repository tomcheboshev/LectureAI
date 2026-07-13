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
        <button class="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" :aria-label="t('appShell.openMenu')" @click="mobileOpen = true">
          <Bars3Icon class="w-6 h-6" />
        </button>

        <div class="flex-1"></div>

        <button
          class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          :title="theme.dark ? t('appShell.switchToLightMode') : t('appShell.switchToDarkMode')"
          :aria-label="theme.dark ? t('appShell.switchToLightMode') : t('appShell.switchToDarkMode')"
          @click="theme.toggle()"
        >
          <SunIcon v-if="theme.dark" class="w-5 h-5" />
          <MoonIcon v-else class="w-5 h-5" />
        </button>
        <RouterLink to="/new" class="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/30 hover:bg-primary-hover transition">
          <PlusIcon class="w-4 h-4" /> {{ t("nav.newPackage") }}
        </RouterLink>

        <div class="relative" ref="profileMenuRef">
          <button class="flex items-center gap-2 rounded-lg pl-1 pr-2.5 py-1 hover:bg-slate-100 dark:hover:bg-white/5 transition" @click="menuOpen = !menuOpen">
            <span class="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold shrink-0">
              {{ initials }}
            </span>
            <span class="hidden md:flex flex-col items-start leading-tight">
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ auth.user?.name }}</span>
              <span class="text-[11px] font-mono uppercase text-slate-400">{{ auth.user?.plan }}</span>
            </span>
          </button>
          <Transition name="fade">
            <div v-if="menuOpen" class="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-lg py-1.5" @click.self.stop>
              <RouterLink to="/settings" class="flex items-center gap-2 px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="menuOpen = false">
                <Cog6ToothIcon class="w-4 h-4" /> {{ t("nav.settings") }}
              </RouterLink>
              <button class="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm text-danger hover:bg-danger/5 transition" @click="doLogout">
                <ArrowRightStartOnRectangleIcon class="w-4 h-4" /> {{ t("nav.logout") }}
              </button>
            </div>
          </Transition>
        </div>
      </header>

      <main class="flex-1 min-w-0">
        <RouterView v-slot="{ Component }">
          <Transition name="page">
            <component :is="Component" :key="$route.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <ToastContainer />
    <UpgradeModal />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { RouterLink, RouterView, useRouter } from "vue-router";
import { Bars3Icon, SunIcon, MoonIcon, PlusIcon, Cog6ToothIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/vue/24/outline";
import { useThemeStore } from "../stores/theme.js";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import { useClickOutside } from "../composables/useClickOutside.js";
import SidebarContent from "../components/SidebarContent.vue";
import ToastContainer from "../components/ui/ToastContainer.vue";
import UpgradeModal from "../components/UpgradeModal.vue";

const theme = useThemeStore();
const auth = useAuthStore();
const toast = useToastStore();
const { t } = useI18n();
const router = useRouter();
const mobileOpen = ref(false);
const menuOpen = ref(false);
const profileMenuRef = ref(null);
useClickOutside(profileMenuRef, () => (menuOpen.value = false));

const initials = computed(() =>
  (auth.user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
);

async function doLogout() {
  menuOpen.value = false;
  await auth.logout();
  toast.success(t("toasts.loggedOut"));
  router.push("/login");
}
</script>
