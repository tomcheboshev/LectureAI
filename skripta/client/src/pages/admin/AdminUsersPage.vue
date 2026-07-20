<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
    <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1.5">{{ t("admin.users.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("admin.users.subtitle") }}</p>

    <div class="flex flex-col sm:flex-row gap-3 mb-5">
      <div class="relative flex-1">
        <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="q"
          type="text"
          :placeholder="t('admin.users.searchPlaceholder')"
          class="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
          @keyup.enter="reload"
        />
      </div>
      <select v-model="plan" class="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-slate-900 dark:text-white px-3 py-2.5" @change="reload">
        <option value="">{{ t("admin.users.filterAllPlans") }}</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <select v-model="banned" class="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-sm text-slate-900 dark:text-white px-3 py-2.5" @change="reload">
        <option value="">{{ t("admin.users.filterAllStatus") }}</option>
        <option value="false">{{ t("admin.users.filterActive") }}</option>
        <option value="true">{{ t("admin.users.filterBanned") }}</option>
      </select>
    </div>

    <div v-if="loading" class="text-center py-16 text-sm text-slate-400">{{ t("admin.users.loading") }}</div>

    <EmptyState v-else-if="!users.length" :icon="UsersIcon" :title="t('admin.users.emptyTitle')" :description="t('admin.users.emptyBody')" />

    <div v-else class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark overflow-hidden">
      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 dark:bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3">{{ t("common.name") }}</th>
            <th class="px-4 py-3">{{ t("common.email") }}</th>
            <th class="px-4 py-3">{{ t("admin.users.plan") }}</th>
            <th class="px-4 py-3">{{ t("admin.users.status") }}</th>
            <th class="px-4 py-3">{{ t("admin.users.joined") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-border-dark">
          <tr
            v-for="u in users"
            :key="u._id"
            class="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition"
            @click="router.push(`/admin/users/${u._id}`)"
          >
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">{{ u.name }}</td>
            <td class="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ u.email }}</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="badge" :class="u.plan === 'free' ? 'badge-primary' : 'badge-success'">{{ u.plan }}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span class="badge" :class="u.banned ? 'badge-danger' : 'badge-success'">{{ u.banned ? t("admin.users.filterBanned") : t("admin.users.filterActive") }}</span>
              <span v-if="u.role === 'admin'" class="badge badge-primary ml-1">{{ t("admin.nav.badge") }}</span>
            </td>
            <td class="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ formatDate(u.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <div v-if="total > limit" class="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
      <span>{{ t("admin.users.pageOf", { page, pages: Math.ceil(total / limit) }) }}</span>
      <div class="flex gap-2">
        <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border-dark disabled:opacity-40" :disabled="page <= 1" @click="changePage(page - 1)">
          {{ t("admin.users.prev") }}
        </button>
        <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border-dark disabled:opacity-40" :disabled="page * limit >= total" @click="changePage(page + 1)">
          {{ t("admin.users.next") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { MagnifyingGlassIcon, UsersIcon } from "@heroicons/vue/24/outline";
import { adminApi } from "../../services/adminApi.js";
import { useI18n } from "../../composables/useI18n.js";
import { reportApiError } from "../../composables/useApiError.js";
import EmptyState from "../../components/ui/EmptyState.vue";

const { t, lang } = useI18n();
const router = useRouter();

const users = ref([]);
const total = ref(0);
const page = ref(1);
const limit = ref(25);
const loading = ref(false);
const q = ref("");
const plan = ref("");
const banned = ref("");

async function reload() {
  loading.value = true;
  try {
    const result = await adminApi.searchUsers({ q: q.value, plan: plan.value, banned: banned.value, page: page.value, limit: limit.value });
    users.value = result.users;
    total.value = result.total;
    page.value = result.page;
  } catch (err) {
    reportApiError(err);
  } finally {
    loading.value = false;
  }
}

function changePage(p) {
  page.value = p;
  reload();
}

function formatDate(d) {
  return new Date(d).toLocaleDateString(lang.value, { day: "numeric", month: "short", year: "numeric" });
}

onMounted(reload);
</script>
