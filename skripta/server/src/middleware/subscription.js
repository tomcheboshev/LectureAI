import { getEffectivePlan } from "../services/billing/subscription.js";

// Hard gate for a route that should be entirely unavailable without an
// active (or trialing, or grace-period) paid subscription — distinct from
// the quota-based gating already used elsewhere (assertPackageLimit,
// planLimits) which lets free users do a limited amount for free rather
// than blocking them outright. This app's free tier is a real, working
// product tier (10 study packages, not zero), so this middleware isn't
// force-applied to the core generation routes — wire it onto any route
// that should be 100% pro-only.
export function requireActiveSubscription(req, res, next) {
  if (getEffectivePlan(req.user) === "free") {
    return res.status(402).json({
      error: "This feature requires an active subscription.",
      upgradeRequired: true,
      reason: "subscription_required",
    });
  }
  next();
}
