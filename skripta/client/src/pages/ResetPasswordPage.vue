<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50 dark:bg-canvas-dark relative overflow-hidden">
    <div class="absolute inset-x-0 -top-20 -z-10 flex justify-center blur-3xl opacity-40 dark:opacity-25">
      <div class="w-[640px] h-[420px] bg-gradient-to-tr from-primary via-secondary to-accent rounded-full"></div>
    </div>

    <div class="w-full max-w-sm">
      <RouterLink to="/" class="flex items-center justify-center gap-2 mb-8">
        <span class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-sm shadow-md shadow-primary/30">L</span>
        <span class="font-display font-bold text-lg text-slate-900 dark:text-white">LectureAI</span>
      </RouterLink>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <template v-if="!done">
          <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1">{{ t("auth.resetPassword.title") }}</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("auth.resetPassword.subtitle") }}</p>

          <form class="flex flex-col gap-4" @submit.prevent="submit">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("auth.resetPassword.newPasswordLabel") }}</label>
              <div class="relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="new-password"
                  class="input-field pr-10"
                  :placeholder="t('auth.resetPassword.passwordPlaceholder')"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  :aria-label="showPassword ? t('common.hidePassword') : t('common.showPassword')"
                  @click="showPassword = !showPassword"
                >
                  <EyeSlashIcon v-if="showPassword" class="w-4 h-4" />
                  <EyeIcon v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("auth.resetPassword.confirmPasswordLabel") }}</label>
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="input-field"
                :placeholder="t('auth.resetPassword.confirmPasswordPlaceholder')"
                :aria-invalid="confirmMismatch"
                aria-describedby="confirm-password-error"
              />
              <p v-if="confirmMismatch" id="confirm-password-error" class="text-xs text-danger mt-1.5" aria-live="polite">{{ t("auth.resetPassword.confirmPasswordMismatch") }}</p>
            </div>

            <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5" aria-live="polite">{{ error }}</div>

            <button :disabled="loading" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 transition mt-2">
              <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
              {{ loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit") }}
            </button>
          </form>
        </template>

        <template v-else>
          <span class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success mb-4">
            <CheckCircleIcon class="w-7 h-7" />
          </span>
          <h1 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-1.5">{{ t("auth.resetPassword.doneTitle") }}</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">{{ t("auth.resetPassword.doneBody") }}</p>
          <RouterLink to="/login" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">{{ t("auth.resetPassword.logIn") }}</RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowPathIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
const route = useRoute();
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref("");
const done = ref(false);

const confirmMismatch = computed(() => confirmPassword.value.length > 0 && password.value !== confirmPassword.value);

async function submit() {
  error.value = "";
  if (confirmMismatch.value) {
    error.value = t("auth.resetPassword.confirmPasswordMismatch");
    return;
  }
  loading.value = true;
  try {
    await api.resetPassword({ token: route.params.token, password: password.value });
    done.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
