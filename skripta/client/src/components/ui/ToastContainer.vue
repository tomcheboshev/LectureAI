<template>
  <div class="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2.5rem))]">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg border text-sm"
        :class="styles[t.type]"
      >
        <component :is="icons[t.type]" class="w-5 h-5 shrink-0 mt-0.5" />
        <p class="flex-1">{{ t.message }}</p>
        <button class="text-current/60 hover:text-current" @click="toast.dismiss(t.id)">
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/vue/24/solid";
import { useToastStore } from "../../stores/toast.js";

const toast = useToastStore();

const styles = {
  success: "bg-white dark:bg-surface-dark border-success/30 text-success",
  error: "bg-white dark:bg-surface-dark border-danger/30 text-danger",
  info: "bg-white dark:bg-surface-dark border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200",
};
const icons = { success: CheckCircleIcon, error: XCircleIcon, info: InformationCircleIcon };
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateY(8px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
