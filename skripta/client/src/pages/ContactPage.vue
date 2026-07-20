<template>
  <div class="min-h-screen bg-slate-50 dark:bg-canvas-dark text-slate-900 dark:text-white">
    <MarketingHeader />

    <div class="max-w-2xl mx-auto px-6 pt-8">
      <Breadcrumbs :items="crumbs" />
    </div>

    <div class="max-w-2xl mx-auto px-6 pt-8 pb-16">
      <h1 class="font-display font-extrabold text-3xl mb-2">{{ t("contact.title") }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-8">{{ t("contact.subtitle") }}</p>

      <div v-if="submitted" class="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        <CheckCircleIcon class="w-10 h-10 text-success mx-auto mb-3" />
        <p class="text-sm text-slate-700 dark:text-slate-200">{{ t("contact.thanks") }}</p>
      </div>

      <div v-else class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-6 space-y-3">
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("common.name") }}</label>
          <input v-model="name" type="text" class="input-field text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("common.email") }}</label>
          <input v-model="email" type="email" class="input-field text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("support.subject") }}</label>
          <input v-model="subject" type="text" class="input-field text-sm" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{{ t("contact.message") }}</label>
          <textarea v-model="message" rows="5" class="input-field text-sm"></textarea>
        </div>
        <div v-if="error" class="text-sm text-danger">{{ error }}</div>
        <button :disabled="submitting" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-40 transition" @click="submit">
          {{ submitting ? t("support.submitting") : t("contact.send") }}
        </button>
      </div>
    </div>

    <MarketingFooter />
  </div>
</template>

<script setup>
import { ref } from "vue";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useI18n } from "../composables/useI18n.js";
import { useSeoMeta } from "../composables/useSeoMeta.js";
import { breadcrumbListSchema } from "../seo/schema.js";
import MarketingHeader from "../components/marketing/MarketingHeader.vue";
import MarketingFooter from "../components/marketing/MarketingFooter.vue";
import Breadcrumbs from "../components/marketing/Breadcrumbs.vue";

const { t } = useI18n();

const crumbs = [
  { label: t("marketing.breadcrumbHome"), path: "/" },
  { label: t("marketing.nav.contactUs"), path: "/contact" },
];

useSeoMeta({
  title: t("seo.contact.title"),
  description: t("seo.contact.description"),
  canonicalPath: "/contact",
  structuredData: [breadcrumbListSchema(crumbs)],
});
const name = ref("");
const email = ref("");
const subject = ref("");
const message = ref("");
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");

async function submit() {
  error.value = "";
  if (!name.value.trim() || !email.value.trim() || !subject.value.trim() || !message.value.trim()) {
    error.value = t("contact.fillAllFields");
    return;
  }
  submitting.value = true;
  try {
    await api.submitContactMessage({ name: name.value, email: email.value, subject: subject.value, message: message.value });
    submitted.value = true;
  } catch (err) {
    error.value = err.message;
  } finally {
    submitting.value = false;
  }
}
</script>
