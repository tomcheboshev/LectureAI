import User from "../../models/User.js";
import Invoice from "../../models/Invoice.js";
import { GRACE_PERIOD_DAYS } from "./stripe.js";

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
  console.log(`[billing] Checkout completed for user ${userId} (customer ${customerId}) — subscription details will follow via customer.subscription.* events.`);
}

async function handleSubscriptionUpdated(subscription) {
  const user = await findUserByCustomerId(typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id);
  if (!user) return;
  applySubscriptionToUser(user, subscription);
  await user.save();
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
  console.log(`[billing] Subscription ended for user ${user._id} — downgraded to free.`);
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
}

// Dispatch table — one entry per Stripe event type this app acts on.
// Unlisted event types are safely ignored (Stripe sends far more event
// types than any single app needs to handle).
export const WEBHOOK_HANDLERS = {
  "checkout.session.completed": (event) => handleCheckoutSessionCompleted(event.data.object),
  "customer.subscription.created": (event) => handleSubscriptionUpdated(event.data.object),
  "customer.subscription.updated": (event) => handleSubscriptionUpdated(event.data.object),
  "customer.subscription.deleted": (event) => handleSubscriptionDeleted(event.data.object),
  "invoice.paid": (event) => handleInvoicePaid(event.data.object),
  "invoice.payment_failed": (event) => handleInvoicePaymentFailed(event.data.object),
};
