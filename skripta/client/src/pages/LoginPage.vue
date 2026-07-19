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
        <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1">{{ t("auth.login.title") }}</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ t("auth.login.subtitle") }}</p>

        <form class="flex flex-col gap-4" @submit.prevent="submit" novalidate>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{{ t("common.email") }}</label>
            <input v-model="form.email" type="email" required autocomplete="email" class="input-field" :placeholder="t('common.emailPlaceholder')" />
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t("auth.login.passwordLabel") }}</label>
              <RouterLink to="/forgot-password" class="text-xs font-semibold text-primary hover:text-primary-hover">{{ t("auth.login.forgot") }}</RouterLink>
            </div>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="input-field pr-10"
                :placeholder="t('auth.login.passwordPlaceholder')"
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

          <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 select-none">
            <input v-model="form.rememberMe" type="checkbox" class="rounded border-slate-300 dark:border-border-dark text-primary focus:ring-primary/40" />
            {{ t("auth.login.rememberMe") }}
          </label>

          <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5" aria-live="polite">{{ error }}</div>

          <button :disabled="loading" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 transition mt-2">
            <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? t("auth.login.submitting") : t("auth.login.submit") }}
          </button>
        </form>

        <OAuthButtons />
      </div>

      <p class="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        {{ t("auth.login.noAccount") }} <RouterLink to="/register" class="font-semibold text-primary hover:text-primary-hover">{{ t("auth.login.signUp") }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import { ArrowPathIcon, EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";
import { useI18n } from "../composables/useI18n.js";
import OAuthButtons from "../components/OAuthButtons.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const toast = useToastStore();
const { t } = useI18n();

const form = reactive({ email: "", password: "", rememberMe: true });
const showPassword = ref(false);
const loading = ref(false);
const error = ref("");

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login({ email: form.email, password: form.password, rememberMe: form.rememberMe });
    toast.success(t("auth.login.welcomeBackToast", { name: auth.user.name }));
    router.push(typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard");
  } catch (e) {
    // The server returns a distinct reason for lockout/OAuth-only accounts
    // (routes/auth.js) — surface those exact messages rather than a
    // generic "invalid credentials" so the user knows what's actually wrong.
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
