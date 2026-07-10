<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-up">
          <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">{{ title ?? t("modal.defaultTitle") }}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-6"><slot /></p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5" @click="$emit('close')">
              {{ cancelLabel ?? t("common.cancel") }}
            </button>
            <button class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-danger hover:bg-red-600 transition" @click="$emit('confirm')">
              {{ confirmLabel ?? t("modal.confirm") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { toRef } from "vue";
import { useI18n } from "../../composables/useI18n.js";
import { useModalBehavior } from "../../composables/useModalBehavior.js";

const { t } = useI18n();

const props = defineProps({
  open: Boolean,
  title: { type: String, default: undefined },
  confirmLabel: { type: String, default: undefined },
  cancelLabel: { type: String, default: undefined },
});
const emit = defineEmits(["close", "confirm"]);
useModalBehavior(toRef(props, "open"), () => emit("close"));
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
