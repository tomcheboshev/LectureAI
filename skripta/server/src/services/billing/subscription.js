// Computes the plan a user should actually be treated as, considering the
// grace period after a failed payment. Stripe flips subscription.status to
// "past_due" the instant a charge fails, but yanking pro access away
// immediately would be harsh — gracePeriodEndsAt (set by the
// invoice.payment_failed webhook, cleared on the next successful payment)
// is the real cutoff.
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isInGracePeriod(user) {
  return Boolean(user.gracePeriodEndsAt && user.gracePeriodEndsAt.getTime() > Date.now());
}

export function getEffectivePlan(user) {
  if (user.plan === "enterprise") return "enterprise"; // manually assigned, not Stripe-managed
  if (user.plan !== "pro") return user.plan;
  if (ACTIVE_STATUSES.has(user.subscriptionStatus)) return "pro";
  if (isInGracePeriod(user)) return "pro";
  return "free";
}

// Called on every authenticated request (see middleware/auth.js) so
// `user.plan` — the field every existing route already reads via
// planLimits(req.user.plan) — never needs a cron job to stay accurate: the
// first request after a grace period lapses is what flips it. Mutates and
// persists `user` in place when a change is needed; a no-op otherwise (the
// overwhelmingly common case, so this stays cheap).
export async function syncEffectivePlan(user) {
  if (user.plan !== "pro") return;
  const effective = getEffectivePlan(user);
  if (effective === "pro") return;
  user.plan = effective;
  await user.save();
}
