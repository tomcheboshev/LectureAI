import { computed } from "vue";
import { useLocaleStore } from "../stores/locale.js";

// Scope: this translates app chrome (navigation, settings, dashboard
// labels) — not AI-generated study content, which the backend always
// produces in English regardless of UI language (translating a whole
// generated study package is a separate, much larger feature).
const DICTIONARY = {
  en: {
    dashboard: "Dashboard",
    newPackage: "New package",
    settings: "Settings",
    logout: "Log out",
    myStudyPackages: "My study packages",
    dashboardSubtitle: "Every lecture you've processed, ready for revision.",
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    language: "Language",
    profile: "Profile",
    account: "Account",
    subscription: "Subscription",
    security: "Security",
    save: "Save",
    cancel: "Cancel",
    name: "Name",
    email: "Email",
    currentPassword: "Current password",
    newPassword: "New password",
    changePassword: "Change password",
    upgradeToPro: "Upgrade to Pro",
    currentPlan: "Current plan",
    deleteAccount: "Delete account",
  },
  mk: {
    dashboard: "Контролна табла",
    newPackage: "Нов пакет",
    settings: "Поставки",
    logout: "Одјава",
    myStudyPackages: "Мои студиски пакети",
    dashboardSubtitle: "Секое предавање што сте го обработиле, подготвено за повторување.",
    appearance: "Изглед",
    light: "Светла",
    dark: "Темна",
    language: "Јазик",
    profile: "Профил",
    account: "Профил",
    subscription: "Претплата",
    security: "Безбедност",
    save: "Зачувај",
    cancel: "Откажи",
    name: "Име",
    email: "Е-пошта",
    currentPassword: "Тековна лозинка",
    newPassword: "Нова лозинка",
    changePassword: "Промени лозинка",
    upgradeToPro: "Надгради на Pro",
    currentPlan: "Тековен план",
    deleteAccount: "Избриши профил",
  },
};

export function useI18n() {
  const locale = useLocaleStore();
  const t = (key) => DICTIONARY[locale.lang]?.[key] ?? DICTIONARY.en[key] ?? key;
  return { t, lang: computed(() => locale.lang) };
}
