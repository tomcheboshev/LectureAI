import Stripe from "stripe";

// Lazily constructed so the module can be imported (e.g. by scripts) even
// before STRIPE_SECRET_KEY is set — the error only surfaces when a route
// actually tries to use it, matching how this app already treats
// OPENROUTER_API_KEY (warn at boot, fail at point of use, never crash startup).
let stripeClient = null;
export function getStripe() {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw Object.assign(new Error("Billing is not configured (STRIPE_SECRET_KEY is not set)."), { userFacing: true, status: 500 });
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Every self-serve plan the pricing UI can check out with. "Student"
// variants are the same pro feature set at a discounted price — self
// attested via a checkbox at checkout, since no third-party verification
// service (e.g. SheerID) is wired up. "enterprise" is intentionally absent
// here: it's assigned manually (sales-led), not self-serve.
export const PLAN_KEYS = ["monthly", "annual", "monthly_student", "annual_student"];

const PRICE_ENV_VAR = {
  monthly: "STRIPE_PRICE_MONTHLY",
  annual: "STRIPE_PRICE_ANNUAL",
  monthly_student: "STRIPE_PRICE_MONTHLY_STUDENT",
  annual_student: "STRIPE_PRICE_ANNUAL_STUDENT",
};

export function priceIdForPlan(planKey) {
  const envVar = PRICE_ENV_VAR[planKey];
  if (!envVar) throw Object.assign(new Error(`Unknown plan "${planKey}".`), { userFacing: true, status: 400 });
  const priceId = process.env[envVar];
  if (!priceId) {
    throw Object.assign(new Error(`Billing is not fully configured yet (${envVar} is not set).`), { userFacing: true, status: 500 });
  }
  return priceId;
}

// Every new subscription — monthly, annual, or student — gets the same
// trial; a failed payment gets this many days of continued pro access
// before the lazy plan-sync (services/billing/subscription.js) actually
// revokes it, giving the card time to be updated via the customer portal
// (Stripe also auto-retries the charge a few times within this window).
export const TRIAL_PERIOD_DAYS = 7;
export const GRACE_PERIOD_DAYS = 7;

// Creates a Stripe Checkout Session for a new (or resumed) subscription.
// Reuses the user's existing Stripe customer if they have one — keeps
// payment methods and invoice history on one customer record across a
// subscribe -> cancel -> resubscribe cycle — otherwise lets Stripe create
// one; checkout.session.completed links it back to the user afterward.
export async function createCheckoutSession({ user, planKey, successUrl, cancelUrl }) {
  const stripe = getStripe();
  const priceId = priceIdForPlan(planKey);
  const isStudent = planKey.endsWith("_student");

  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    client_reference_id: String(user._id),
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { userId: String(user._id), planKey, isStudent: String(isStudent) },
    },
    metadata: { userId: String(user._id), planKey, isStudent: String(isStudent) },
    // Lets the user enter a promo code on the Checkout page itself —
    // covers "Coupons / Promo Codes" without any custom code/redemption
    // logic of our own; coupons are managed entirely in the Stripe Dashboard.
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// The Stripe Billing Portal is a Stripe-hosted page that natively covers
// upgrade/downgrade (switching price), cancel, resume (un-cancel before
// period end), payment-method update, and invoice history/download — all
// PCI-scope-free since it never touches our server. Building custom UI for
// any of that would just be reimplementing this less reliably.
export async function createBillingPortalSession({ user, returnUrl }) {
  const stripe = getStripe();
  if (!user.stripeCustomerId) {
    throw Object.assign(new Error("You don't have a billing account yet — subscribe first."), { userFacing: true, status: 400 });
  }
  return stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: returnUrl });
}

// The Billing Portal's "Cancel subscription" flow only supports
// cancel-at-period-end (hardcoded in scripts/stripe-setup.mjs) — it
// structurally cannot cancel immediately. These two functions are the
// in-app equivalent, used by the custom Keep/Cancel-at-period-end/
// Cancel-immediately modal. Both re-fetch the subscription from Stripe
// first rather than trusting the locally-cached user.stripeSubscriptionId
// status, since local state can lag a webhook by a few seconds.
//
// Neither function writes to Mongo or sends email — that's deliberately
// left entirely to the webhook pipeline (customer.subscription.updated /
// .deleted), which fires identically whether the change originated here or
// from the Billing Portal. Two independent call sites both writing state
// and firing emails would risk double-sends; one write path avoids that
// by construction instead of needing de-duplication logic.
export async function cancelSubscription({ user, mode, reason }) {
  const stripe = getStripe();
  if (!user.stripeSubscriptionId) {
    throw Object.assign(new Error("You don't have an active subscription to cancel."), { userFacing: true, status: 400 });
  }
  const current = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  if (current.status === "canceled") {
    throw Object.assign(new Error("This subscription is already canceled."), { userFacing: true, status: 400 });
  }
  const cancellation_details = reason ? { comment: reason } : undefined;
  if (mode === "immediate") {
    return stripe.subscriptions.cancel(user.stripeSubscriptionId, { cancellation_details });
  }
  return stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true, cancellation_details });
}

export async function resumeSubscription({ user }) {
  const stripe = getStripe();
  if (!user.stripeSubscriptionId) {
    throw Object.assign(new Error("You don't have a subscription to resume."), { userFacing: true, status: 400 });
  }
  const current = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  if (current.status === "canceled") {
    throw Object.assign(
      new Error("This subscription has already ended and can't be resumed — please subscribe again."),
      { userFacing: true, status: 400 }
    );
  }
  if (!current.cancel_at_period_end) {
    throw Object.assign(new Error("This subscription isn't scheduled to cancel."), { userFacing: true, status: 400 });
  }
  return stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
}
