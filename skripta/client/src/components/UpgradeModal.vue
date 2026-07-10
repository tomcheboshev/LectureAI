<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="upgrade.open" class="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="upgrade.hide()"></div>
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-7 animate-fade-up">
          <span class="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary text-white mb-4">
            <SparklesIcon class="w-6 h-6" />
          </span>
          <h3 class="font-display font-extrabold text-xl text-slate-900 dark:text-white mb-1.5">{{ t("upgradeModal.title") }}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300 mb-5">{{ upgrade.message }}</p>

          <ul class="flex flex-col gap-2 mb-6">
            <li v-for="f in proFeatures" :key="f" class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckIcon class="w-4 h-4 text-success shrink-0 mt-0.5" /> {{ t(f) }}
            </li>
          </ul>

          <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5 mb-4">{{ error }}</div>

          <div class="flex gap-2">
            <button class="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition" @click="upgrade.hide()">
              {{ t("upgradeModal.maybeLater") }}
            </button>
            <button
              :disabled="loading"
              class="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition"
              @click="doUpgrade"
            >
              <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
              {{ loading ? t("upgradeModal.upgrading") : t("common.upgradeToPro") }}
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-3 text-center">{{ t("upgradeModal.disclaimer") }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from "vue";
import { SparklesIcon, CheckIcon, ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useUpgradeStore } from "../stores/upgrade.js";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import { useModalBehavior } from "../composables/useModalBehavior.js";

const upgrade = useUpgradeStore();
const auth = useAuthStore();
const toast = useToastStore();
const { t } = useI18n();
const loading = ref(false);
const error = ref("");
useModalBehavior(
  computed(() => upgrade.open),
  () => upgrade.hide()
);

const proFeatures = [
  "upgradeModal.features.unlimitedPackages",
  "upgradeModal.features.moreFiles",
  "upgradeModal.features.unlimitedChat",
  "upgradeModal.features.priorityQueue",
  "upgradeModal.features.noWatermark",
];

async function doUpgrade() {
  error.value = "";
  loading.value = true;
  try {
    await auth.upgrade("pro");
    toast.success(t("toasts.upgradedToPro"));
    upgrade.hide();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
