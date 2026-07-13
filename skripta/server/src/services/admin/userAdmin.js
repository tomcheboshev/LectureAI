import User from "../../models/User.js";
import StudyPackage from "../../models/StudyPackage.js";
import Invoice from "../../models/Invoice.js";
import AiUsage from "../../models/AiUsage.js";
import AdminActionLog from "../../models/AdminActionLog.js";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function logAction(admin, action, targetId, detail) {
  // Fire-and-forget-ish, but awaited by callers — a failed log write should
  // never be silent, so callers still await this rather than treating it as
  // best-effort.
  return AdminActionLog.create({ admin: admin._id, action, targetType: "User", targetId, detail });
}

export async function searchUsers({ q, plan, banned, role, page = 1, limit = PAGE_SIZE_DEFAULT }) {
  const filter = {};
  if (q && q.trim()) {
    const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }];
  }
  if (plan) filter.plan = plan;
  if (banned !== undefined) filter.banned = banned === "true" || banned === true;
  if (role) filter.role = role;

  const safeLimit = Math.min(Number(limit) || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
  const safePage = Math.max(Number(page) || 1, 1);

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { users, total, page: safePage, limit: safeLimit };
}

export async function getUserDetail(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const [packageCount, storageAgg, aiUsageAgg, invoices] = await Promise.all([
    StudyPackage.countDocuments({ owner: userId }),
    StudyPackage.aggregate([
      { $match: { owner: user._id } },
      { $project: { size: { $strLenCP: { $ifNull: ["$raw_transcript", ""] } } } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
    AiUsage.aggregate([
      { $match: { owner: user._id } },
      { $group: { _id: null, calls: { $sum: 1 }, totalTokens: { $sum: "$totalTokens" }, estimatedCostUsd: { $sum: "$estimatedCostUsd" } } },
    ]),
    Invoice.find({ owner: userId }).sort({ createdAt: -1 }).limit(25).lean(),
  ]);

  return {
    user,
    usage: {
      packages: packageCount,
      storageChars: storageAgg[0]?.total || 0,
      aiCalls: aiUsageAgg[0]?.calls || 0,
      aiTotalTokens: aiUsageAgg[0]?.totalTokens || 0,
      aiEstimatedCostUsd: aiUsageAgg[0]?.estimatedCostUsd || 0,
    },
    invoices,
  };
}

export async function banUser(admin, userId, reason) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.banned = true;
  user.bannedAt = new Date();
  user.banReason = reason || null;
  user.refreshTokens = []; // force logout everywhere
  await user.save();
  await logAction(admin, "user_banned", userId, { reason: reason || null });
  return user;
}

export async function unbanUser(admin, userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.banned = false;
  user.bannedAt = null;
  user.banReason = null;
  await user.save();
  await logAction(admin, "user_unbanned", userId, null);
  return user;
}

// Soft-delete/anonymize: scrubs PII and blocks login via `banned`, but never
// touches StudyPackage/Invoice/AiUsage/etc. — those keep referencing this
// User document (with its _id intact) so revenue/usage history never
// dangles. This is a deliberate deviation from the self-serve DELETE
// /api/auth/me route, which hard-deletes.
export async function softDeleteUser(admin, userId) {
  const user = await User.findById(userId).select("+passwordHash +refreshTokens");
  if (!user) return null;

  user.name = "Deleted user";
  user.email = `deleted-${user._id}@deleted.invalid`;
  user.passwordHash = "!"; // not a valid bcrypt hash — comparePassword can never match it
  user.banned = true;
  user.bannedAt = new Date();
  user.banReason = "deleted_by_admin";
  user.refreshTokens = [];
  await user.save();

  await logAction(admin, "user_deleted", userId, null);
  return user;
}

const OVERRIDABLE_PLANS = ["free", "pro", "enterprise"];

// Writes User.plan/subscriptionStatus directly, bypassing Stripe entirely —
// for support cases like a failed webhook. A future webhook delivery can
// still overwrite this back; the caller-facing UI must warn about that.
export async function overrideSubscription(admin, userId, { plan, subscriptionStatus }) {
  const user = await User.findById(userId);
  if (!user) return null;

  const before = { plan: user.plan, subscriptionStatus: user.subscriptionStatus };
  if (plan !== undefined) {
    if (!OVERRIDABLE_PLANS.includes(plan)) throw new Error(`plan must be one of: ${OVERRIDABLE_PLANS.join(", ")}.`);
    user.plan = plan;
  }
  if (subscriptionStatus !== undefined) {
    user.subscriptionStatus = subscriptionStatus || null;
  }
  await user.save();

  await logAction(admin, "user_subscription_overridden", userId, { before, after: { plan: user.plan, subscriptionStatus: user.subscriptionStatus } });
  return user;
}
