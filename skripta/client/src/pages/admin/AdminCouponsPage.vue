<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.coupons.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.coupons.subtitle") }}</p>

    <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 mb-6">
      <h2 class="font-display font-bold text-sm text-slate-900 dark:text-white mb-4">{{ t("admin.coupons.newCoupon") }}</h2>
      <div class="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.coupons.code") }}</label>
          <input v-model="code" type="text" :placeholder="t('admin.coupons.codePlaceholder')" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.coupons.percentOff") }}</label>
          <input v-model.number="percentOff" type="number" min="1" max="100" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.coupons.duration") }}</label>
          <select v-model="duration" class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm px-3 py-2">
            <option value="once">{{ t("admin.coupons.once") }}</option>
            <option value="repeating">{{ t("admin.coupons.repeating") }}</option>
            <option value="forever">{{ t("admin.coupons.forever") }}</option>
          </select>
        </div>
        <div v-if="duration === 'repeating'">
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("admin.coupons.durationMonths") }}</label>
          <input v-model.number="durationInMonths" type="number" min="1" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm" />
        </div>
      </div>
      <button :disabled="creating" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition" @click="create">
        {{ creating ? t("admin.support.updated") : t("admin.coupons.create") }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-10 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>
    <ul v-else class="space-y-2">
      <li v-for="pc in promotionCodes" :key="pc.id" class="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-mono font-semibold text-slate-900 dark:text-white">{{ pc.code }}</p>
          <p class="text-xs text-slate-400">
            {{ pc.promotion?.coupon?.percent_off ? `${pc.promotion.coupon.percent_off}% off` : `$${(pc.promotion?.coupon?.amount_off / 100).toFixed(2)} off` }} · {{ pc.promotion?.coupon?.duration }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge" :class="pc.active ? 'badge-success' : 'badge-danger'">{{ pc.active ? t("admin.health.set") : t("admin.coupons.inactive") }}</span>
          <button class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="toggleActive(pc)">
            {{ pc.active ? t("admin.coupons.deactivate") : t("admin.coupons.activate") }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import { useToastStore } from "../../stores/toast.js";

const { t } = useI18n();
const toast = useToastStore();

const promotionCodes = ref([]);
const loading = ref(false);
const creating = ref(false);
const code = ref("");
const percentOff = ref(10);
const duration = ref("once");
const durationInMonths = ref(3);

async function reload() {
  loading.value = true;
  try {
    const result = await adminApi.listCoupons();
    promotionCodes.value = result.promotionCodes;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

async function create() {
  creating.value = true;
  try {
    await adminApi.createCoupon({
      code: code.value || undefined,
      percentOff: percentOff.value,
      duration: duration.value,
      durationInMonths: duration.value === "repeating" ? durationInMonths.value : undefined,
    });
    code.value = "";
    toast.success(t("admin.coupons.created"));
    await reload();
  } catch (err) {
    reportApiError(err);
  } finally {
    creating.value = false;
  }
}

async function toggleActive(pc) {
  try {
    await adminApi.setCouponActive(pc.id, !pc.active);
    await reload();
  } catch (err) {
    reportApiError(err);
  }
}

onMounted(reload);
</script>
