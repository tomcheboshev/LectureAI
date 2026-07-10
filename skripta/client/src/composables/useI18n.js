import { computed } from "vue";
import { useLocaleStore } from "../stores/locale.js";
import en from "../locales/en.js";
import mk from "../locales/mk.js";

// Scope: this translates app chrome (navigation, pages, dialogs, forms,
// toasts, validation messages) — not AI-generated study content, which the
// backend always produces in English regardless of UI language (translating
// a whole generated study package is a separate, much larger feature).
const DICTIONARIES = { en, mk };

function resolve(dict, key) {
  return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
}

function pickPlural(entry, params) {
  if (entry && typeof entry === "object" && ("one" in entry || "other" in entry)) {
    const n = Number(params?.count);
    return Number.isFinite(n) && Math.abs(n) === 1 ? entry.one : entry.other;
  }
  return entry;
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
}

export function useI18n() {
  const locale = useLocaleStore();

  function t(key, params) {
    let entry = pickPlural(resolve(DICTIONARIES[locale.lang], key), params);
    if (entry === undefined) entry = pickPlural(resolve(DICTIONARIES.en, key), params);
    if (entry === undefined) return key;
    return typeof entry === "string" ? interpolate(entry, params) : entry;
  }

  return { t, lang: computed(() => locale.lang) };
}
