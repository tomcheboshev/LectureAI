<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50" @click="!loading && $emit('close')"></div>
      <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto animate-fade-up">
        <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-2">{{ title ?? t("modal.defaultTitle") }}</h3>
        <div class="text-sm text-slate-600 dark:text-slate-300 mb-6"><slot /></div>
        <div class="flex justify-end gap-2">
          <button :disabled="loading" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition" @click="$emit('close')">
            {{ cancelLabel ?? t("common.cancel") }}
          </button>
          <button :disabled="loading" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-danger hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition" @click="$emit('confirm')">
            <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
            {{ confirmLabel ?? t("modal.confirm") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { toRef } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "../../composables/useI18n.js";
import { useModalBehavior } from "../../composables/useModalBehavior.js";

const { t } = useI18n();

const props = defineProps({
  open: Boolean,
  title: { type: String, default: undefined },
  confirmLabel: { type: String, default: undefined },
  cancelLabel: { type: String, default: undefined },
  // Disables both buttons and blocks backdrop/Escape dismissal while a
  // confirm action is in flight — without this, the confirm button could be
  // clicked repeatedly, firing duplicate destructive requests (delete
  // account, revoke all sessions) before the first one resolves.
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "confirm"]);
useModalBehavior(
  toRef(props, "open"),
  () => !props.loading && emit("close")
);
</script>
