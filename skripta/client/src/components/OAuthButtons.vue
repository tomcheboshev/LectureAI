<template>
  <div v-if="providers && (providers.google || providers.github)">
    <div class="relative my-5">
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200 dark:border-border-dark"></div></div>
      <div class="relative flex justify-center text-xs">
        <span class="bg-white dark:bg-surface-dark px-3 text-slate-400">{{ t("common.orContinueWith") }}</span>
      </div>
    </div>
    <div class="flex flex-col gap-2.5">
      <a
        v-if="providers.google"
        href="/api/auth/oauth/google"
        class="inline-flex items-center justify-center gap-2.5 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500 transition"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
        </svg>
        {{ t("common.continueWithGoogle") }}
      </a>
      <a
        v-if="providers.github"
        href="/api/auth/oauth/github"
        class="inline-flex items-center justify-center gap-2.5 rounded-xl border-2 border-slate-200 dark:border-border-dark px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-500 transition"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z"
          />
        </svg>
        {{ t("common.continueWithGithub") }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "../services/api.js";
import { useI18n } from "../composables/useI18n.js";

const { t } = useI18n();
const providers = ref(null);

onMounted(async () => {
  try {
    providers.value = await api.getOAuthProviders();
  } catch {
    // A failed capability check just means no buttons show — not worth
    // surfacing as an error on a login/register page.
    providers.value = { google: false, github: false };
  }
});
</script>
