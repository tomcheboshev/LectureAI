import User from "../../models/User.js";
import Invoice from "../../models/Invoice.js";
import { GRACE_PERIOD_DAYS, getStripe } from "./stripe.js";
import {
  sendWelcomePremiumEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionResumedEmail,
  sendRefundProcessedEmail,
} from "./emails.js";
import { creditReferralIfApplicable } from "./referrals.js";

// Field-path notes (verified against the installed `stripe` package's own
// .d.ts files, not assumed from memory — this API version moved several
// fields that older Stripe docs/examples still show at the top level):
//   - Subscription has NO top-level current_period_end/current_period_start
//     anymore; it lives per-item at subscription.items.data[0].current_period_end.
//   - Invoice has NO top-level `subscription` field anymore; it's nested at
//     invoice.parent.subscription_details.subscription.

function toDate(unixSeconds) {
  return Number.isFinite(unixSeconds) ? new Date(unixSeconds * 1000) : null;
}

function subscriptionIdFromInvoice(invoice) {
  const sub = invoice.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : sub?.id || null;
}

async function findUserByCustomerId(customerId) {
  if (!customerId) return null;
  const user = await User.findOne({ stripeCustomerId: customerId });
  if (!user) console.error(`[billing] Webhook referenced unknown Stripe customer ${customerId} — no matching user.`);
  return user;
}

// The one place that decides whether a subscription counts as "the
// checked-out plan is a student plan" — matched by price ID against the two
// student env vars rather than trusting subscription.metadata, since
// metadata can be absent on subscriptions Stripe/an admin creates by hand
// (e.g. directly in the Dashboard while testing).
function isStudentPriceId(priceId) {
  return priceId && (priceId === process.env.STRIPE_PRICE_MONTHLY_STUDENT || priceId === process.env.STRIPE_PRICE_ANNUAL_STUDENT);
}

// Applies a Stripe Subscription object's state onto our User document —
// the single source of truth for subscriptionStatus/priceId/interval/
// currentPeriodEnd/cancelAtPeriodEnd/trialEndsAt, called from every
// subscription-lifecycle event so they can't drift out of sync with each
// other.
function applySubscriptionToUser(user, subscription) {
  const item = subscription.items?.data?.[0];
  const price = item?.price;

  user.stripeSubscriptionId = subscription.id;
  user.subscriptionStatus = subscription.status;
  user.stripePriceId = price?.id || null;
  user.billingInterval = price?.recurring?.interval || null;
  user.isStudent = isStudentPriceId(price?.id);
  user.currentPeriodEnd = toDate(item?.current_period_end);
  user.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  user.trialEndsAt = toDate(subscription.trial_end);

  const activeStatuses = new Set(["active", "trialing"]);
  if (activeStatuses.has(subscription.status)) {
    user.plan = "pro";
    user.gracePeriodEndsAt = null; // a healthy status means any prior payment trouble resolved
  } else if (subscription.status === "past_due" || subscription.status === "unpaid") {
    // Leave `plan` as-is — syncEffectivePlan() (called on every request via
    // requireAuth) is what actually downgrades once gracePeriodEndsAt
    // passes; invoice.payment_failed is what sets that field.
  } else {
    // canceled / incomplete_expired / paused — no grace period applies to a
    // subscription that's definitively over, not just temporarily unpaid.
    user.plan = "free";
    user.gracePeriodEndsAt = null;
  }
}

async function handleCheckoutSessionCompleted(session) {
  if (session.mode !== "subscription") return; // not a billing checkout we care about here
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    console.error("[billing] checkout.session.completed had no client_reference_id/userId metadata — cannot link to a user.");
    return;
  }
  const user = await User.findById(userId);
  if (!user) {
    console.error(`[billing] checkout.session.completed referenced unknown user ${userId}.`);
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId && user.stripeCustomerId !== customerId) {
    user.stripeCustomerId = customerId;
    await user.save();
  }
  await creditReferralIfApplicable(session);
  console.log(`[billing] Checkout completed for user ${userId} (customer ${customerId}) — subscription details will follow via customer.subscription.* events.`);
}

async function handleSubscriptionUpdated(subscription, { isNew = false } = {}) {
  const user = await findUserByCustomerId(typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  if (!user) return;
  // Captured before applySubscriptionToUser overwrites it — the edge
  // (false->true / true->false) is the single trigger point for
  // Subscription Cancelled / Subscription Resumed emails (wired in
  // services/billing/emails.js), covering both Billing-Portal-initiated and
  // in-app (routes/billing.js POST /cancel, /resume) changes identically,
  // since both paths converge on this same webhook rather than emailing
  // from the route handler itself.
  const wasCancelAtPeriodEnd = Boolean(user.cancelAtPeriodEnd);
  const isNowCancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);

  applySubscriptionToUser(user, subscription);
  await user.save();

  if (isNew) {
    console.log(`[billing] New subscription for user ${user._id} (status=${subscription.status}).`);
    await sendWelcomePremiumEmail(user);
  } else if (!wasCancelAtPeriodEnd && isNowCancelAtPeriodEnd) {
    console.log(`[billing] Subscription for user ${user._id} scheduled to cancel at period end.`);
    await sendSubscriptionCancelledEmail(user);
  } else if (wasCancelAtPeriodEnd && !isNowCancelAtPeriodEnd) {
    console.log(`[billing] Subscription for user ${user._id} resumed (cancellation undone).`);
    await sendSubscriptionResumedEmail(user);
  }
  console.log(`[billing] Subscription synced for user ${user._id}: status=${subscription.status}, plan=${user.plan}, cancelAtPeriodEnd=${user.cancelAtPeriodEnd}`);
}

async function handleSubscriptionDeleted(subscription) {
  const user = await findUserByCustomerId(typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  if (!user) return;
  user.plan = "free";
  user.subscriptionStatus = "canceled";
  user.cancelAtPeriodEnd = false;
  user.gracePeriodEndsAt = null;
  await user.save();
  // Covers the immediate-cancellation path (POST /cancel {mode:"immediate"}
  // or the subscription simply lapsing past its period end) — this event
  // fires instead of .updated for those cases, so it needs its own
  // Subscription Cancelled trigger rather than relying solely on the
  // edge-detection above.
  console.log(`[billing] Subscription ended for user ${user._id} — downgraded to free.`);
  await sendSubscriptionCancelledEmail(user);
}

// Fires ~3 days before subscription.trial_end (Stripe's own fixed schedule,
// not configurable). No state mutation needed — its only job is triggering
// the Trial Ending email.
async function handleTrialWillEnd(subscription) {
  const user = await findUserByCustomerId(typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  if (!user) return;
  console.log(`[billing] Trial ending soon for user ${user._id} (trial_end=${toDate(subscription.trial_end)?.toISOString()}).`);
  await sendTrialEndingEmail(user);
}

// event.data.object for charge.refunded IS the full Charge, so customer/
// invoice are directly available with no extra Stripe API call.
async function handleChargeRefunded(charge) {
  const user = await findUserByCustomerId(typeof charge.customer === "string" ? charge.customer : charge.customer?.id);
  if (!user) return;
  const invoiceId = typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
  if (invoiceId) {
    await Invoice.updateOne({ stripeInvoiceId: invoiceId }, { refunded: true, amountRefunded: charge.amount_refunded });
  }
  console.log(`[billing] Refund processed for user ${user._id}: ${charge.amount_refunded} ${charge.currency} (charge ${charge.id}).`);
  await sendRefundProcessedEmail(user, charge);
}

// event.data.object for charge.dispute.created is a Dispute, which only
// carries the charge ID (string) — fetch the charge itself to resolve the
// customer/invoice, same as any other webhook lookup in this file.
async function handleDisputeCreated(dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
  if (!chargeId) return;
  const charge = await getStripe().charges.retrieve(chargeId);
  const user = await findUserByCustomerId(typeof charge.customer === "string" ? charge.customer : charge.customer?.id);
  if (!user) return;
  const invoiceId = typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id;
  if (invoiceId) await Invoice.updateOne({ stripeInvoiceId: invoiceId }, { disputed: true });
  // Deliberately no customer-facing email — a chargeback is adversarial
  // (the customer disputed the charge with their bank), not a routine
  // notice. Surfaced to admins via the chargebacks list (services/admin).
  console.warn(`[billing] Chargeback opened for user ${user._id}: charge ${chargeId}, reason=${dispute.reason}.`);
}

async function upsertInvoiceRecord(invoice) {
  const user = await findUserByCustomerId(typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id);
  if (!user) return null;

  await Invoice.findOneAndUpdate(
    { stripeInvoiceId: invoice.id },
    {
      owner: user._id,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionIdFromInvoice(invoice),
      status: invoice.status,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdfUrl: invoice.invoice_pdf || null,
      periodStart: toDate(invoice.period_start),
      periodEnd: toDate(invoice.period_end),
      createdAt: toDate(invoice.created) || new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return user;
}

async function handleInvoicePaid(invoice) {
  const user = await upsertInvoiceRecord(invoice);
  if (!user) return;
  // A successful payment always clears any in-progress grace period, even
  // if this invoice belongs to a different subscription than the one that
  // originally failed (e.g. the user resubscribed on a new plan).
  if (user.gracePeriodEndsAt) {
    user.gracePeriodEndsAt = null;
    await user.save();
  }
  // billing_reason distinguishes the very first invoice of a subscription
  // ("subscription_create") from a renewal ("subscription_cycle") — the
  // first is already covered by the Welcome Premium email fired from
  // customer.subscription.created above, so only renewals get a Payment
  // Success email here (with the invoice PDF link inline, per the locked
  // decision to collapse Payment Success / Subscription Renewed / Invoice
  // Available into one email instead of three per renewal).
  if (invoice.billing_reason === "subscription_cycle") {
    console.log(`[billing] Renewal invoice paid for user ${user._id}: ${invoice.id}.`);
    await sendPaymentSuccessEmail(user, invoice);
  }
  console.log(`[billing] Invoice paid for user ${user._id}: ${invoice.id} (${invoice.amount_paid} ${invoice.currency}).`);
}

async function handleInvoicePaymentFailed(invoice) {
  const user = await upsertInvoiceRecord(invoice);
  if (!user) return;
  // Only start a grace period for a failure on the user's CURRENT
  // subscription — an invoice from an old, already-superseded subscription
  // failing (e.g. a stale retry) shouldn't punish an otherwise-healthy one.
  const invoiceSubId = subscriptionIdFromInvoice(invoice);
  if (invoiceSubId && invoiceSubId !== user.stripeSubscriptionId) {
    console.log(`[billing] Ignoring payment failure for user ${user._id}: invoice belongs to a superseded subscription.`);
    return;
  }
  user.gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  await user.save();
  console.warn(`[billing] Payment failed for user ${user._id} — grace period until ${user.gracePeriodEndsAt.toISOString()}.`);
  await sendPaymentFailedEmail(user);
}

// Dispatch table — one entry per Stripe event type this app acts on.
// Unlisted event types are safely ignored (Stripe sends far more event
// types than any single app needs to handle).
export const WEBHOOK_HANDLERS = {
  "checkout.session.completed": (event) => handleCheckoutSessionCompleted(event.data.object),
  "customer.subscription.created": (event) => handleSubscriptionUpdated(event.data.object, { isNew: true }),
  "customer.subscription.updated": (event) => handleSubscriptionUpdated(event.data.object),
  "customer.subscription.deleted": (event) => handleSubscriptionDeleted(event.data.object),
  "customer.subscription.trial_will_end": (event) => handleTrialWillEnd(event.data.object),
  "invoice.paid": (event) => handleInvoicePaid(event.data.object),
  "invoice.payment_failed": (event) => handleInvoicePaymentFailed(event.data.object),
  "charge.refunded": (event) => handleChargeRefunded(event.data.object),
  "charge.dispute.created": (event) => handleDisputeCreated(event.data.object),
};
