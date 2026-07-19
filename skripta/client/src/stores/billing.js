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
    // Redirects to Stripe's hosted Billing Portal — covers payment method
    // updates and invoice history/download; upgrade/downgrade/cancel/resume
    // now also have in-app equivalents below.
    async openBillingPortal() {
      const { url } = await api.createBillingPortalSession();
      window.location.href = url;
    },
    // The server doesn't write to Mongo for cancel/resume (that's the
    // webhook pipeline's job) so its response is only a partial snapshot
    // {status, cancelAtPeriodEnd, currentPeriodEnd} — merged into the
    // existing subscription object rather than replacing it, so fields this
    // response doesn't touch (plan, billingInterval, trialEndsAt, ...)
    // aren't wiped out before the webhook has a chance to fully resync.
    async cancel(mode, reason) {
      const result = await api.cancelSubscription(mode, reason);
      this.subscription = { ...this.subscription, ...result };
      return result;
    },
    async resume() {
      const result = await api.resumeSubscription();
      this.subscription = { ...this.subscription, ...result };
      return result;
    },
  },
});
