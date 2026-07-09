import { defineStore } from "pinia";

export const useThemeStore = defineStore("theme", {
  state: () => ({
    dark: false,
  }),
  actions: {
    init() {
      const saved = localStorage.getItem("lectureai-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.apply(saved ? saved === "dark" : prefersDark);
    },
    apply(isDark) {
      this.dark = isDark;
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("lectureai-theme", isDark ? "dark" : "light");
    },
    toggle() {
      this.apply(!this.dark);
    },
  },
});
