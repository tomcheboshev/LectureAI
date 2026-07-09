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

      <div v-if="!done" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <h1 class="font-display font-extrabold text-2xl text-slate-900 dark:text-white mb-1">Create your account</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">Free plan — 10 study packages, no credit card.</p>

        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Name</label>
            <input v-model="form.name" required maxlength="100" autocomplete="name" class="input-field" placeholder="Ada Lovelace" />
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
            <input v-model="form.email" type="email" required autocomplete="email" class="input-field" placeholder="you@example.com" />
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Password</label>
            <input v-model="form.password" type="password" required autocomplete="new-password" class="input-field" placeholder="At least 8 characters" />
            <p class="text-xs text-slate-400 mt-1.5">At least 8 characters, with a letter and a number.</p>
          </div>

          <div v-if="error" class="rounded-xl border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-2.5">{{ error }}</div>

          <button :disabled="loading" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-40 transition mt-2">
            <ArrowPathIcon v-if="loading" class="w-4 h-4 animate-spin" />
            {{ loading ? "Creating account…" : "Create account" }}
          </button>
        </form>
      </div>

      <div v-else class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none text-center">
        <span class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success mb-4">
          <CheckCircleIcon class="w-7 h-7" />
        </span>
        <h1 class="font-display font-extrabold text-xl text-slate-900 dark:text-white mb-1.5">You're in</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Check your email to verify your account. No email provider is wired up yet, so here's the link directly:</p>
        <a v-if="devLink" :href="devLink" class="block text-xs font-mono break-all text-primary bg-primary/5 rounded-lg px-3 py-2.5 mb-5 hover:underline">{{ devLink }}</a>
        <RouterLink to="/dashboard" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">
          Go to dashboard
        </RouterLink>
      </div>

      <p v-if="!done" class="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
        Already have an account? <RouterLink to="/login" class="font-semibold text-primary hover:text-primary-hover">Log in</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/auth.js";

const auth = useAuthStore();

const form = reactive({ name: "", email: "", password: "" });
const loading = ref(false);
const error = ref("");
const done = ref(false);
const devLink = ref("");

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    const { devVerificationLink } = await auth.register({ name: form.name, email: form.email, password: form.password });
    devLink.value = devVerificationLink || "";
    done.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>
