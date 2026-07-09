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
        <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1">Welcome back</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Log in to your LectureAI account.</p>

        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
            <input v-model="form.email" type="email" required autocomplete="email" class="input-field" placeholder="you@example.com" />
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Password</label>
              <RouterLink to="/forgot-password" class="text-xs font-semibold text-primary hover:text-primary-hover">Forgot?</RouterLink>
            </div>
            <input v-model="form.password" type="password" required autocomplete="current-password" class="input-field" placeholder="••••••••" />
          </div>

          <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5">{{ error }}</div>

          <button :disabled="loading" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 transition mt-2">
            <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? "Logging in…" : "Log in" }}
          </button>
        </form>
      </div>

      <p class="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        Don't have an account? <RouterLink to="/register" class="font-semibold text-primary hover:text-primary-hover">Sign up</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/auth.js";
import { useToastStore } from "../stores/toast.js";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const toast = useToastStore();

const form = reactive({ email: "", password: "" });
const loading = ref(false);
const error = ref("");

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login({ email: form.email, password: form.password });
    toast.success(`Welcome back, ${auth.user.name}.`);
    router.push(typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard");
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
