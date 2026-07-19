// Single client-side source of truth for display pricing — consumed by
// UpgradeModal.vue, PricingPage.vue, and the SoftwareApplication JSON-LD
// offers. Mirrors server/scripts/stripe-setup.mjs's cent amounts
// (999/7900/499/3950); the real charge always comes from the actual Stripe
// Price server-side regardless of what's shown here, but keep these in
// sync if pricing changes so nothing shown to a user is ever misleading.
export const TRIAL_DAYS = 7;

export const PRICING_PLANS = {
  monthly: 9.99,
  annual: 79,
  monthly_student: 4.99,
  annual_student: 39.5,
};
