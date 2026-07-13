import { defineStore } from "pinia";
import { api } from "../services/api.js";

// Subscription state + billing history, loaded on demand (settings page,
// upgrade modal) rather than at app boot — unlike auth.user this isn't
// needed for route guards, so there's no reason to fetch it eagerly.
export const useBillingStore = defineStore("billing", {
  state: () => ({
    subscription: null,
    invoices: [],
    loading: false,
  }),
  actions: {
    async fetchSubscription() {
      this.loading = true;
      try {
        this.subscription = await api.getSubscription();
      } finally {
        this.loading = false;
      }
    },
    async fetchInvoices() {
      const { invoices } = await api.getInvoices();
      this.invoices = invoices;
    },
    // Redirects the browser to Stripe Checkout — the caller doesn't need to
    // do anything after this resolves except stay on the loading state,
    // since navigation.location replaces the current page.
    async startCheckout(planKey) {
      const { url } = await api.createCheckoutSession(planKey);
      window.location.href = url;
    },
    // Redirects to Stripe's hosted Billing Portal — covers upgrade,
    // downgrade, cancel, resume, payment method updates, and invoice
    // history/download, all without any custom UI of our own.
    async openBillingPortal() {
      const { url } = await api.createBillingPortalSession();
      window.location.href = url;
    },
  },
});
