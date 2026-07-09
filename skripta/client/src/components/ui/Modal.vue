<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-up">
          <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">{{ title }}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-6"><slot /></p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5" @click="$emit('close')">
              {{ cancelLabel }}
            </button>
            <button class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-danger hover:bg-red-600 transition" @click="$emit('confirm')">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  open: Boolean,
  title: { type: String, default: "Are you sure?" },
  confirmLabel: { type: String, default: "Confirm" },
  cancelLabel: { type: String, default: "Cancel" },
});
defineEmits(["close", "confirm"]);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
