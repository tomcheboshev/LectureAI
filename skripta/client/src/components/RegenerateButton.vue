<template>
  <button
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5 transition disabled:opacity-50"
    :disabled="loading"
    @click="confirmOpen = true"
  >
    <ArrowPathIcon class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
    {{ loading ? t("regenerateButton.loading") : t("regenerateButton.label") }}
  </button>

  <Modal
    :open="confirmOpen"
    :title="t('regenerateButton.confirmTitle')"
    :confirm-label="t('regenerateButton.label')"
    @close="confirmOpen = false"
    @confirm="run"
  >
    {{ t("regenerateButton.confirmBody") }}
  </Modal>
</template>

<script setup>
import { ref } from "vue";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import Modal from "./ui/Modal.vue";

const props = defineProps({
  packageId: { type: String, required: true },
  section: { type: String, required: true },
});
const emit = defineEmits(["regenerated"]);

const toast = useToastStore();
const { t } = useI18n();
const loading = ref(false);
const confirmOpen = ref(false);

async function run() {
  confirmOpen.value = false;
  loading.value = true;
  try {
    const data = await api.regenerateSection(props.packageId, props.section);
    emit("regenerated", data);
    toast.success(t("toasts.regenerated"));
  } catch (e) {
    toast.error(e.message);
  } finally {
    loading.value = false;
  }
}
</script>
