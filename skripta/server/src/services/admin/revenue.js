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

  return {
    totalUsers,
    newUsers,
    activeUsers,
    premiumUsers,
    monthlyRevenue,
    annualRevenue,
    mrr,
    userGrowthSeries: growth,
    revenueSeries: revenue,
  };
}
