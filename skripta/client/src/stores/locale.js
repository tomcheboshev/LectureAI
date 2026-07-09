import { defineStore } from "pinia";

export const useLocaleStore = defineStore("locale", {
  state: () => ({ lang: "en" }),
  actions: {
    init() {
      this.lang = localStorage.getItem("lectureai-lang") || "en";
    },
    set(lang) {
      this.lang = lang;
      localStorage.setItem("lectureai-lang", lang);
    },
  },
});
