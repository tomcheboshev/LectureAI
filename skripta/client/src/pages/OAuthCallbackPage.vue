<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50 dark:bg-canvas-dark relative overflow-hidden">
    <div class="absolute inset-x-0 -top-20 -z-10 flex justify-center blur-3xl opacity-40 dark:opacity-25">
      <div class="w-[640px] h-[420px] bg-gradient-to-tr from-primary via-secondary to-accent rounded-full"></div>
    </div>

    <div class="w-full max-w-sm text-center">
      <RouterLink to="/" class="flex items-center justify-center gap-2 mb-8">
        <span class="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-sm shadow-md shadow-primary/30">L</span>
        <span class="font-display font-bold text-lg text-slate-900 dark:text-white">LectureAI</span>
      </RouterLink>

      <div class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <ArrowPathIcon v-if="status === 'loading'" class="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
        <span v-else-if="status === 'success'" class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success mb-4">
          <CheckCircleIcon class="w-7 h-7" />
        </span>
        <span v-else class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 text-danger mb-4">
          <XCircleIcon class="w-7 h-7" />
        </span>

        <h1 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-1.5">
          {{ status === "loading" ? t("auth.oauthCallback.loading") : status === "success" ? t("auth.oauthCallback.success") : t("auth.oauthCallback.failed") }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">{{ message }}</p>
        <RouterLink v-if="status === 'error'" to="/login" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">
          {{ t("auth.oauthCallback.backToLogin") }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/auth.js";
import { useI18n } from "../composables/useI18n.js";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const status = ref("loading");
const message = ref("");

// Every branch (new account / auto-linked / repeat login / link-additional-
// provider) lands here identically — the server has already set the
// refresh+CSRF cookies via the same issueTokens() path as password login by
// the time this page loads; the only job left client-side is to pick that
// session up (see stores/auth.js's restoreSession()) and route onward.
onMounted(async () => {
  if (route.query.status === "success") {
    try {
      await auth.restoreSession();
      status.value = "success";
      message.value = t("auth.oauthCallback.successBody");
      router.push("/dashboard");
    } catch (e) {
      status.value = "error";
      message.value = e.message || t("auth.oauthCallback.reasons.server_error");
    }
    return;
  }

  status.value = "error";
  const reason = typeof route.query.reason === "string" ? route.query.reason : "server_error";
  message.value = t(`auth.oauthCallback.reasons.${reason}`) || t("auth.oauthCallback.reasons.server_error");
});
</script>
