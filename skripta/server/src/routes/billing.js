import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  getStripe,
  PLAN_KEYS,
  TRIAL_PERIOD_DAYS,
} from "../services/billing/stripe.js";
import { getEffectivePlan, isInGracePeriod } from "../services/billing/subscription.js";
import Invoice from "../models/Invoice.js";

const router = Router();
router.use(requireAuth);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// POST /api/billing/checkout  { plan: "monthly"|"annual"|"monthly_student"|"annual_student" }
// Starts a new subscription (or lets an existing Stripe customer add one
// back after canceling). Returns a URL to redirect the browser to — the
// actual card entry happens on Stripe's own hosted page, never ours.
router.post("/checkout", async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_KEYS.includes(plan)) {
      return res.status(400).json({ error: `plan must be one of: ${PLAN_KEYS.join(", ")}.` });
    }
    const session = await createCheckoutSession({
      user: req.user,
      planKey: plan,
      // Stripe substitutes the {CHECKOUT_SESSION_ID} literal itself — the
      // new payment-result pages use it to call GET
      // /billing/checkout-session/:id rather than trusting the redirect
      // alone (webhooks may still be in flight when the browser lands here).
      successUrl: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${CLIENT_URL}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session creation failed:", err);
    respondError(res, err, "Could not start checkout. Please try again.");
  }
});

// POST /api/billing/portal
// Stripe's hosted Billing Portal covers upgrade/downgrade (switching
// price), cancel, resume, payment-method updates, and invoice
// history/download — this just opens it for the signed-in user's
// existing Stripe customer.
router.post("/portal", async (req, res) => {
  try {
    const session = await createBillingPortalSession({ user: req.user, returnUrl: `${CLIENT_URL}/settings` });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal session creation failed:", err);
    respondError(res, err, "Could not open the billing portal. Please try again.");
  }
});

// GET /api/billing/subscription — everything the settings page needs to
// render current plan/status/renewal/trial/grace-period state.
router.get("/subscription", (req, res) => {
  const user = req.user;
  res.json({
    plan: user.plan,
    effectivePlan: getEffectivePlan(user),
    subscriptionStatus: user.subscriptionStatus,
    billingInterval: user.billingInterval,
    isStudent: user.isStudent,
    currentPeriodEnd: user.currentPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    trialEndsAt: user.trialEndsAt,
    gracePeriodEndsAt: user.gracePeriodEndsAt,
    inGracePeriod: isInGracePeriod(user),
    hasBillingAccount: Boolean(user.stripeCustomerId),
    trialDays: TRIAL_PERIOD_DAYS,
  });
});

// GET /api/billing/invoices — in-app billing history (a local read cache
// synced by the webhook handlers; each entry also links straight to
// Stripe's hosted PDF for "Download Invoice").
router.get("/invoices", async (req, res) => {
  const invoices = await Invoice.find({ owner: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ invoices });
});

// POST /api/billing/cancel  { mode: "period_end"|"immediate", reason?: string }
// The in-app equivalent of the Billing Portal's cancel flow, extended to
// also support immediate cancellation (which the Portal can't do). Doesn't
// write to Mongo or send email itself — see cancelSubscription()'s comment
// for why that's deliberately left to the webhook pipeline alone.
router.post("/cancel", async (req, res) => {
  try {
    const { mode, reason } = req.body;
    if (mode !== "period_end" && mode !== "immediate") {
      return res.status(400).json({ error: 'mode must be "period_end" or "immediate".' });
    }
    const subscription = await cancelSubscription({ user: req.user, mode, reason: typeof reason === "string" ? reason.slice(0, 500) : undefined });
    // A partial snapshot (not the full GET /subscription shape) — the
    // client merges this into its existing subscription state rather than
    // replacing it, so fields this response doesn't touch (plan,
    // billingInterval, trialEndsAt, ...) aren't wiped out. Mongo itself
    // isn't updated here — that's the webhook pipeline's job — so this is
    // purely an immediate-feedback snapshot for the redirect page.
    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
    res.json({
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: Number.isFinite(currentPeriodEnd) ? new Date(currentPeriodEnd * 1000) : null,
    });
  } catch (err) {
    console.error("Subscription cancellation failed:", err);
    respondError(res, err, "Could not cancel your subscription. Please try again.");
  }
});

// POST /api/billing/resume — undoes a scheduled cancel-at-period-end.
router.post("/resume", async (req, res) => {
  try {
    const subscription = await resumeSubscription({ user: req.user });
    const currentPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
    res.json({
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: Number.isFinite(currentPeriodEnd) ? new Date(currentPeriodEnd * 1000) : null,
    });
  } catch (err) {
    console.error("Subscription resume failed:", err);
    respondError(res, err, "Could not resume your subscription. Please try again.");
  }
});

// POST /api/billing/retry-invoice  { invoiceId }
// Used by the Payment Failed page's "Retry Payment" button — re-attempts
// charging the same open invoice against the customer's current default
// payment method (e.g. after they've updated their card via the Portal).
router.post("/retry-invoice", async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ error: "invoiceId is required." });
    // Ownership check against our local cache before ever touching Stripe —
    // never let a client retry an invoice ID that isn't theirs.
    const invoice = await Invoice.findOne({ stripeInvoiceId: invoiceId, owner: req.userId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    const stripe = getStripe();
    const paid = await stripe.invoices.pay(invoiceId);
    res.json({ status: paid.status });
  } catch (err) {
    console.error("Invoice retry failed:", err);
    respondError(res, err, "The payment attempt failed. Please check your payment method and try again.");
  }
});

// GET /api/billing/checkout-session/:id — looks up a completed Checkout
// Session for the payment-result pages (success/pending), which land here
// via redirect before the webhook may have finished processing. Verifies
// the session actually belongs to the signed-in user before returning
// anything — a session ID is guessable/shareable, ownership is not optional.
router.get("/checkout-session/:id", async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.id, { expand: ["subscription"] });
    const ownerId = session.client_reference_id || session.metadata?.userId;
    if (!ownerId || String(ownerId) !== String(req.userId)) {
      return res.status(404).json({ error: "Checkout session not found." });
    }
    const subscription = session.subscription;
    res.json({
      paymentStatus: session.payment_status,
      subscriptionStatus: typeof subscription === "string" ? null : subscription?.status || null,
      plan: session.metadata?.planKey || null,
      isStudent: session.metadata?.isStudent === "true",
    });
  } catch (err) {
    console.error("Checkout session lookup failed:", err);
    respondError(res, err, "Could not look up this checkout session.");
  }
});

export default router;
