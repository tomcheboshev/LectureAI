import mongoose from "mongoose";
import crypto from "crypto";

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: String,
    // Per-session metadata, set at issuance (routes/auth.js issueTokens()) —
    // sessionId is the stable handle the Sessions UI revokes by (tokenHash
    // itself is never sent to the client). device/browser/os are parsed from
    // userAgent via ua-parser-js at issuance time rather than re-parsed on
    // every list request.
    sessionId: { type: String, default: () => crypto.randomUUID() },
    ip: String,
    device: String,
    browser: String,
    os: String,
    lastActiveAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One subdoc per linked social-login provider. The compound unique index
// (declared below, after the main schema) prevents the same external
// account (e.g. one Google account) ever being linked to two different
// LectureAI Users.
const ConnectedAccountSchema = new Schema(
  {
    provider: { type: String, enum: ["google", "github"], required: true },
    providerAccountId: { type: String, required: true },
    email: String,
    connectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    // `name` stays a real, stored (not virtual) field for backward
    // compatibility with every existing read site (emails, admin lists,
    // sanitizeUser, etc.) — it's auto-derived from firstName/lastName by the
    // pre("save") hook below, so none of those call sites need to change.
    name: { type: String, required: true, trim: true, maxlength: 100 },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Optional because an OAuth-only user (Google/GitHub, no password ever
    // set) has none — every password-check call site must guard for this
    // before calling bcrypt.compare (see services/auth/password.js callers).
    passwordHash: { type: String, required: false, select: false },
    pictureUrl: { type: String, default: null },
    connectedAccounts: { type: [ConnectedAccountSchema], default: [] },

    // --- Login security (brute-force protection) ---------------------------
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },

    // --- Account deletion (30-day soft-delete with reactivate) ------------
    // Stores the actual purge timestamp (requestedAt + 30d), not the request
    // date itself — every reader just compares against `now` directly.
    deletionScheduledAt: { type: Date, default: null, index: true },

    // --- Pending email change (requires the NEW address to re-verify
    // before `email` itself is updated) --------------------------------
    pendingEmail: { type: String, select: false },
    pendingEmailTokenHash: { type: String, select: false },
    pendingEmailExpires: { type: Date, select: false },

    // `plan` is the field every other route already reads (planLimits(),
    // assertPackageLimit(), etc.) — kept as the single source of truth for
    // feature gating so nothing downstream needs to change. Webhooks below
    // are what keep it in sync with reality now, instead of the old
    // direct-flip POST /api/auth/upgrade stub.
    plan: { type: String, enum: ["free", "pro", "enterprise"], default: "free", index: true },

    // Granted only via server/scripts/grant-admin.mjs, run manually from the
    // terminal — there is no self-serve promotion endpoint anywhere in the app.
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    banned: { type: Boolean, default: false, index: true },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, default: null },

    // --- Stripe subscription state (synced by webhook handlers, never
    // written directly by a client-facing route) ---------------------------
    stripeCustomerId: { type: String, index: true },
    stripeSubscriptionId: { type: String, index: true },
    // Mirrors Stripe's own subscription.status values verbatim
    // (incomplete/incomplete_expired/trialing/active/past_due/canceled/
    // unpaid/paused) rather than inventing a parallel enum — anyone
    // debugging can cross-reference the Stripe Dashboard directly.
    subscriptionStatus: { type: String, default: null },
    stripePriceId: { type: String, default: null },
    billingInterval: { type: String, enum: ["month", "year", null], default: null },
    isStudent: { type: Boolean, default: false },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    trialEndsAt: { type: Date, default: null },
    // Set when a payment fails (invoice.payment_failed) to `now + grace
    // period`; cleared on the next successful payment. While this is in the
    // future, the user keeps pro-tier access even though Stripe's own
    // subscription.status has already flipped to "past_due" — see
    // services/billing/subscription.js's getEffectivePlan().
    gracePeriodEndsAt: { type: Date, default: null },

    // --- Referral program (friend gets a discount only, no referrer
    // reward) — a personal Stripe Promotion Code minted lazily on first
    // request against the one shared "lectureai-referral" Coupon. -----------
    referralCode: { type: String, unique: true, sparse: true, index: true },
    referralPromotionCodeId: { type: String, default: null },
    referralRedemptions: { type: Number, default: 0 },

    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, index: true },
    emailVerificationExpires: { type: Date, select: false },
    // Guards the "resend verification email" button against rapid
    // double-clicks — independent of the token's own 24h expiry.
    lastVerificationEmailSentAt: { type: Date, default: null, select: false },

    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpires: { type: Date, select: false },

    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },
  },
  { timestamps: true }
);

// Prevents the same external account (e.g. one specific Google account)
// from ever being linked to two different LectureAI Users.
UserSchema.index({ "connectedAccounts.provider": 1, "connectedAccounts.providerAccountId": 1 }, { unique: true, sparse: true });

// Keeps the legacy `name` field in sync whenever firstName/lastName change,
// so every existing read site (emails, admin lists, sanitizeUser, etc.)
// keeps working unmodified — see Phase 18 plan's call-site audit.
// Must be pre("validate"), not pre("save") — Mongoose runs schema
// validation (which enforces `name`'s `required:true`) BEFORE "save"
// middleware, so deriving it in a pre("save") hook would be too late and
// every create() with only firstName/lastName would fail validation first.
UserSchema.pre("validate", function (next) {
  if (this.isModified("firstName") || this.isModified("lastName")) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
  }
  next();
});

export default mongoose.model("User", UserSchema);
