import { defineStore } from "pinia";

export const useUpgradeStore = defineStore("upgrade", {
  state: () => ({
    open: false,
    reason: "",
    message: "",
    limit: null,
  }),
  actions: {
    show({ reason, message, limit } = {}) {
      this.reason = reason || "";
      this.message = message || "You've hit a limit on your current plan.";
      this.limit = limit ?? null;
      this.open = true;
    },
    hide() {
      this.open = false;
    },
  },
});
