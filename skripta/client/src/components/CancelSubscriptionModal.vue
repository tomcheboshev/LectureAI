<template>
  <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="close"></div>
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="font-display font-bold text-lg text-slate-900 dark:text-white mb-1.5">{{ t("settings.billing.cancelModal.title") }}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">{{ t("settings.billing.cancelModal.subtitle") }}</p>

          <div class="flex flex-col gap-2.5 mb-4">
            <button
              type="button"
              class="w-full text-left rounded-xl border-2 border-slate-200 dark:border-border-dark p-3.5 hover:border-primary/40 hover:bg-primary/5 transition"
              @click="close"
            >
              <p class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ t("settings.billing.cancelModal.keep") }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ t("settings.billing.cancelModal.keepDesc") }}</p>
            </button>

            <button
              type="button"
              :disabled="submitting"
              class="w-full text-left rounded-xl border-2 border-slate-200 dark:border-border-dark p-3.5 hover:border-warning/50 hover:bg-warning/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
              @click="submit('period_end')"
            >
              <p class="font-semibold text-sm text-slate-800 dark:text-slate-100">{{ t("settings.billing.cancelModal.periodEnd") }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {{ periodEndDate ? t("settings.billing.cancelModal.periodEndDesc", { date: periodEndDate }) : t("settings.billing.cancelModal.periodEndDescNoDate") }}
              </p>
            </button>

            <button
              type="button"
              :disabled="submitting"
              class="w-full text-left rounded-xl border-2 border-danger/30 p-3.5 hover:border-danger/60 hover:bg-danger/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
              @click="submit('immediate')"
            >
              <p class="font-semibold text-sm text-danger">{{ t("settings.billing.cancelModal.immediate") }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ t("settings.billing.cancelModal.immediateDesc") }}</p>
            </button>
          </div>

          <div class="mb-4">
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("settings.billing.cancelModal.reasonLabel") }}</label>
            <textarea v-model="reason" rows="2" maxlength="500" class="input-field text-sm" :placeholder="t('settings.billing.cancelModal.reasonPlaceholder')"></textarea>
          </div>

          <div class="flex justify-end">
            <button type="button" :disabled="submitting" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50" @click="close">
              {{ t("common.cancel") }}
            </button>
          </div>
        </div>
      </div>
  </Teleport>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "../composables/useI18n.js";
import { useBillingStore } from "../stores/billing.js";
import { reportApiError } from "../composables/useApiError.js";
import { useModalBehavior } from "../composables/useModalBehavior.js";

const props = defineProps({
  open: Boolean,
  periodEndDate: { type: String, default: "" },
});
const emit = defineEmits(["close"]);

const { t } = useI18n();
const router = useRouter();
const billing = useBillingStore();
const reason = ref("");
const submitting = ref(false);

function close() {
  if (submitting.value) return;
  emit("close");
}
useModalBehavior(
  () => props.open,
  () => close()
);

async function submit(mode) {
  submitting.value = true;
  try {
    await billing.cancel(mode, reason.value.trim() || undefined);
    emit("close");
    router.push({ name: "subscription-cancelled" });
  } catch (e) {
    reportApiError(e);
  } finally {
    submitting.value = false;
  }
}
</script>
