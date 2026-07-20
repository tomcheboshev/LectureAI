import User from "../../models/User.js";
import Invoice from "../../models/Invoice.js";
import DailyActivity from "../../models/DailyActivity.js";
import { todayKeyUTC, addDaysUTC } from "../analytics/activity.js";
import { monthlyEquivalentAmount } from "./pricing.js";

const ACTIVE_STATUSES = ["active", "trialing"];
const ACTIVE_USER_WINDOW_DAYS = 30;
const NEW_USER_WINDOW_DAYS = 30;
const GROWTH_SERIES_DAYS = 90;
const REVENUE_SERIES_MONTHS = 12;

function startOfUtcMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function startOfUtcYear(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

async function computeMrr() {
  const rows = await User.aggregate([
    { $match: { plan: { $in: ["pro", "enterprise"] }, subscriptionStatus: { $in: ACTIVE_STATUSES }, stripePriceId: { $ne: null } } },
    { $group: { _id: "$stripePriceId", count: { $sum: 1 } } },
  ]);

  let totalCents = 0;
  for (const row of rows) {
    // A price lookup failure (e.g. deleted in Stripe) shouldn't blank out
    // the whole MRR figure — skip that slice and keep summing the rest.
    try {
      const monthly = await monthlyEquivalentAmount(row._id);
      totalCents += monthly * row.count;
    } catch (err) {
      console.error(`MRR: could not resolve price ${row._id}:`, err.message);
    }
  }
  return totalCents / 100;
}

async function sumPaidInvoices(from, to) {
  const rows = await Invoice.aggregate([
    { $match: { status: "paid", createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$amountPaid" } } },
  ]);
  return (rows[0]?.total || 0) / 100;
}

async function countActiveUsers() {
  // Distinct owners in DailyActivity can include stale references — the
  // self-serve DELETE /api/auth/me route hard-deletes the User but doesn't
  // cascade DailyActivity — so re-check existence rather than trusting the
  // distinct owner count directly.
  const since = addDaysUTC(todayKeyUTC(), -ACTIVE_USER_WINDOW_DAYS);
  const owners = await DailyActivity.distinct("owner", { date: { $gte: since } });
  if (!owners.length) return 0;
  return User.countDocuments({ _id: { $in: owners } });
}

async function userGrowthSeries() {
  const since = new Date(Date.now() - GROWTH_SERIES_DAYS * 24 * 60 * 60 * 1000);
  const rows = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, count: r.count }));
}

async function revenueSeries() {
  const since = new Date(Date.now() - REVENUE_SERIES_MONTHS * 31 * 24 * 60 * 60 * 1000);
  const rows = await Invoice.aggregate([
    { $match: { status: "paid", createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, total: { $sum: "$amountPaid" } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ month: r._id, amountUsd: r.total / 100 }));
}

// Count of paying (active or trialing) subscribers — the denominator for
// both ARPU and churn rate below.
async function countPayingSubscribers() {
  return User.countDocuments({ subscriptionStatus: { $in: ACTIVE_STATUSES } });
}

// Point-in-time approximation, not a true cohort-based rate: there is no
// historical monthly snapshot job recording how many subscribers existed at
// the START of the month, so this instead divides "subscriptions that ended
// this calendar month" (by Mongo's updatedAt, a reasonable proxy since
// applySubscriptionToUser() only touches a canceled subscription's document
// once, right when it's canceled) by the CURRENT paying-subscriber count.
// This is documented here rather than silently presented as exact — swap in
// a real cohort calculation (requires a recurring snapshot job) if the
// business ever needs board-grade churn reporting.
async function computeChurnRate() {
  const monthStart = startOfUtcMonth();
  const [canceledThisMonth, payingNow] = await Promise.all([
    User.countDocuments({ subscriptionStatus: "canceled", updatedAt: { $gte: monthStart } }),
    countPayingSubscribers(),
  ]);
  if (payingNow === 0) return 0;
  return canceledThisMonth / payingNow;
}

// LTV = ARPU / churn rate — the standard subscription-SaaS approximation.
// Both this and churnRate above inherit the same point-in-time-approximation
// caveat, since LTV is directly derived from churn.
async function computeLtv(mrr, churnRate) {
  const payingNow = await countPayingSubscribers();
  if (payingNow === 0 || churnRate === 0) return 0;
  const arpu = mrr / payingNow;
  return arpu / churnRate;
}

// Most recent refunds/chargebacks — flagged onto Invoice by the
// charge.refunded / charge.dispute.created webhook handlers (17.1).
async function listRefunds() {
  const invoices = await Invoice.find({ refunded: true }).sort({ updatedAt: -1 }).limit(50).populate("owner", "name email").lean();
  return invoices.map((inv) => ({
    invoiceId: inv.stripeInvoiceId,
    userId: inv.owner?._id || null,
    userName: inv.owner?.name || null,
    userEmail: inv.owner?.email || null,
    amountRefunded: inv.amountRefunded || 0,
    currency: inv.currency,
    disputed: inv.disputed,
    updatedAt: inv.updatedAt,
  }));
}

// Subscriptions that are either fully ended or scheduled to end — covers
// both the immediate-cancel and cancel-at-period-end paths from 17.1/17.4.
async function listCancelledSubscriptions() {
  const users = await User.find({
    stripeSubscriptionId: { $ne: null },
    $or: [{ subscriptionStatus: "canceled" }, { cancelAtPeriodEnd: true }],
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select("name email plan subscriptionStatus cancelAtPeriodEnd currentPeriodEnd updatedAt")
    .lean();
  return users;
}

// Self-attested at checkout (isStudent), not third-party verified — see
// scripts/stripe-setup.mjs's student-price comments for why. This just
// surfaces who's using it, for spotting abuse.
async function studentDiscountUsage() {
  const [activeCount, users] = await Promise.all([
    User.countDocuments({ isStudent: true, subscriptionStatus: { $in: ACTIVE_STATUSES } }),
    User.find({ isStudent: true }).sort({ updatedAt: -1 }).limit(50).select("name email plan subscriptionStatus billingInterval updatedAt").lean(),
  ]);
  return { activeCount, users };
}

export async function getOverviewStats() {
  const now = new Date();
  const monthStart = startOfUtcMonth(now);
  const yearStart = startOfUtcYear(now);
  const newUserSince = new Date(now.getTime() - NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalUsers, newUsers, premiumUsers, activeUsers, monthlyRevenue, annualRevenue, mrr, growth, revenue] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: newUserSince } }),
    User.countDocuments({ plan: { $in: ["pro", "enterprise"] } }),
    countActiveUsers(),
    sumPaidInvoices(monthStart, new Date(now.getTime() + 1)),
    sumPaidInvoices(yearStart, new Date(now.getTime() + 1)),
    computeMrr(),
    userGrowthSeries(),
    revenueSeries(),
  ]);

  // arr is a straight annualization of current MRR (a projection); it's
  // distinct from `annualRevenue` above, which is actual paid invoices
  // year-to-date — kept both since they answer different questions.
  const arr = mrr * 12;
  const churnRate = await computeChurnRate();
  const ltv = await computeLtv(mrr, churnRate);
  const [refunds, cancelledSubscriptions, studentDiscounts] = await Promise.all([listRefunds(), listCancelledSubscriptions(), studentDiscountUsage()]);

  return {
    totalUsers,
    newUsers,
    activeUsers,
    premiumUsers,
    monthlyRevenue,
    annualRevenue,
    mrr,
    arr,
    churnRate,
    ltv,
    refunds,
    cancelledSubscriptions,
    studentDiscounts,
    userGrowthSeries: growth,
    revenueSeries: revenue,
  };
}
