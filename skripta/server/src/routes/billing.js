import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { createCheckoutSession, createBillingPortalSession, PLAN_KEYS, TRIAL_PERIOD_DAYS } from "../services/billing/stripe.js";
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
      successUrl: `${CLIENT_URL}/settings?checkout=success`,
      cancelUrl: `${CLIENT_URL}/settings?checkout=cancel`,
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

export default router;
