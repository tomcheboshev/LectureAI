import { defineStore } from "pinia";
import { api } from "../services/api.js";
import { setAccessToken, setUnauthorizedHandler } from "../services/api.js";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    limits: null,
    usage: null,
    ready: false, // true once the initial silent-refresh attempt has resolved
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isPro: (state) => state.user?.plan === "pro" || state.user?.plan === "enterprise",
  },
  actions: {
    // Called once at app startup: tries to restore a session from the
    // httpOnly refresh cookie so a page reload doesn't log the user out.
    async init() {
      if (this.ready) return;
      setUnauthorizedHandler(() => this.clearSession());
      try {
        const { accessToken, user } = await api.refresh();
        setAccessToken(accessToken);
        this.user = user;
        await this.fetchMe();
      } catch {
        this.clearSession();
      } finally {
        this.ready = true;
      }
    },

    async register(payload) {
      const { accessToken, user, devVerificationLink } = await api.register(payload);
      setAccessToken(accessToken);
      this.user = user;
      await this.fetchMe();
      return { devVerificationLink };
    },

    async login(payload) {
      const { accessToken, user } = await api.login(payload);
      setAccessToken(accessToken);
      this.user = user;
      await this.fetchMe();
    },

    async logout() {
      try {
        await api.logout();
      } catch {
        // Best-effort — clear local state regardless.
      }
      this.clearSession();
    },

    clearSession() {
      setAccessToken(null);
      this.user = null;
      this.limits = null;
      this.usage = null;
    },

    async fetchMe() {
      const { user, limits, usage } = await api.getMe();
      this.user = user;
      this.limits = limits;
      this.usage = usage;
    },

    async updateProfile(payload) {
      const { user } = await api.updateProfile(payload);
      this.user = user;
    },

    async deleteAccount(password) {
      await api.deleteAccount({ password });
      this.clearSession();
    },
  },
});
