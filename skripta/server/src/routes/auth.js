import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import validator from "validator";
import User from "../models/User.js";
import StudyPackage from "../models/StudyPackage.js";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { planLimitsForClient } from "../services/subscription.js";
import { hashPassword, comparePassword, validatePasswordStrength } from "../services/auth/password.js";
import {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS_SHORT,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  EMAIL_CHANGE_TTL_MS,
} from "../services/auth/tokens.js";
import { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerification } from "../services/auth/email.js";
import { checkLockout, recordFailedAttempt, resetLockout } from "../services/auth/lockout.js";
import { parseUserAgent, listSessions, revokeSession, revokeOtherSessions, revokeAllSessions } from "../services/auth/sessions.js";
import { saveAvatar, deleteAvatarIfOwned } from "../services/auth/avatars.js";
import { issueCsrfCookie, requireCsrf } from "../middleware/csrf.js";
import { logError } from "../utils/logger.js";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

const router = Router();
const isDev = process.env.NODE_ENV !== "production";
const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
};

// Auth endpoints are the classic brute-force / spam target — cap them
// separately and more tightly than the general API rate limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    pictureUrl: user.pictureUrl,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
    deletionScheduledAt: user.deletionScheduledAt,
    createdAt: user.createdAt,
  };
}

// `rememberMe` controls both the server-side session TTL and whether the
// cookie itself carries a `maxAge` (browser-session cookie when not
// remembered) — see tokens.js's REFRESH_TOKEN_TTL_MS_SHORT comment for why
// these are two independent layers, not one.
// Exported so routes/oauth.js's login/register/link callback can issue
// tokens through the exact same path as password-based login — one
// issuance seam, not a parallel one for social login.
export async function issueTokens(res, user, req, { rememberMe = true } = {}) {
  const accessToken = signAccessToken(user._id);
  const refreshToken = generateOpaqueToken();
  const ttlMs = rememberMe ? REFRESH_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS_SHORT;
  const { device, browser, os } = parseUserAgent(req.headers["user-agent"]);

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + ttlMs),
    userAgent: req.headers["user-agent"]?.slice(0, 200),
    ip: req.ip,
    device,
    browser,
    os,
  });
  // Cap concurrent sessions per account instead of growing unbounded.
  if (user.refreshTokens.length > 10) user.refreshTokens = user.refreshTokens.slice(-10);
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, { ...REFRESH_COOKIE_OPTS, ...(rememberMe ? { maxAge: ttlMs } : {}) });
  // Minted alongside every refresh-cookie issuance (login/register/refresh)
  // so the client always has a fresh CSRF token to echo back on the two
  // cookie-only-authenticated routes (see middleware/csrf.js's comment for
  // why only those two need it). Its maxAge must mirror the refresh
  // cookie's own — see issueCsrfCookie's comment for why.
  issueCsrfCookie(res, rememberMe ? ttlMs : undefined);
  return accessToken;
}

function validateFirstLast(firstName, lastName) {
  if (!firstName || typeof firstName !== "string" || !firstName.trim() || firstName.trim().length > 50) {
    return "First name is required (max 50 characters).";
  }
  if (!lastName || typeof lastName !== "string" || !lastName.trim() || lastName.trim().length > 50) {
    return "Last name is required (max 50 characters).";
  }
  return null;
}

// POST /api/auth/register  { firstName, lastName, email, password, confirmPassword }
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    const nameError = validateFirstLast(firstName, lastName);
    if (nameError) return res.status(400).json({ error: nameError });
    if (!email || !validator.isEmail(String(email))) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    // Never trust a client-only confirm-password check — re-validate here
    // even though RegisterPage.vue also checks this before submitting.
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await hashPassword(password);
    const user = await User.create({ firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, passwordHash });

    const verificationToken = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    user.lastVerificationEmailSentAt = new Date();
    await user.save();
    const devLink = await sendVerificationEmail(user, verificationToken);

    const accessToken = await issueTokens(res, user, req);
    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      ...(isDev ? { devVerificationLink: devLink } : {}),
    });
  } catch (err) {
    logError(err, { route: "register" });
    respondError(res, err, "Registration failed. Please try again.");
  }
});

// POST /api/auth/login  { email, password, rememberMe }
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    // +refreshTokens is required here (not just +passwordHash etc.) because
    // issueTokens() below reads/mutates user.refreshTokens — without it
    // selected, Mongoose treats the field as "not loaded" (undefined), and
    // issueTokens()'s `user.refreshTokens = user.refreshTokens || []`
    // would silently replace the WHOLE array with a brand-new one instead
    // of appending, wiping out every other device's active session on
    // every single login. (This bug predates Phase 18 — surfaced now that
    // sessions are actually user-visible.)
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select(
      "+passwordHash +failedLoginAttempts +lockoutUntil +refreshTokens"
    );
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    // Checked before touching bcrypt at all — a locked-out account's
    // attempts shouldn't get another free password-comparison CPU cycle nor
    // a chance to reset the lockout early via a lucky guess.
    if (checkLockout(user)) {
      return res.status(423).json({ error: "Too many failed attempts. Please try again in a few minutes.", reason: "account_locked" });
    }

    // An OAuth-only account (Google/GitHub, never set a password) has no
    // passwordHash to compare against — bcrypt.compare would throw on a
    // non-string hash. Telling the user which method to use instead is safe
    // to reveal (unlike "this email exists"): it's a real UX need and not
    // itself account-sensitive information.
    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account signs in with Google or GitHub — use that instead.", reason: "oauth_only" });
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      recordFailedAttempt(user);
      await user.save();
      return res.status(401).json({ error: "Invalid email or password." });
    }
    // Defense in depth: requireAuth already blocks banned users on every
    // subsequent request, but this stops a banned user from even minting a
    // fresh token in the first place.
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended.", reason: "account_banned" });

    resetLockout(user);
    const accessToken = await issueTokens(res, user, req, { rememberMe: rememberMe !== false });
    res.json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    logError(err, { route: "login" });
    respondError(res, err, "Login failed. Please try again.");
  }
});

// POST /api/auth/logout
router.post("/logout", requireCsrf, async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const tokenHash = hashToken(token);
    await User.updateOne({ "refreshTokens.tokenHash": tokenHash }, { $pull: { refreshTokens: { tokenHash } } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
});

// POST /api/auth/refresh — rotates the refresh token and issues a new access token
//
// requireCsrf here relies on issueTokens() always minting a csrf_token
// cookie alongside the refresh_token cookie (same path, matching maxAge) —
// so any legitimately-issued refresh cookie always has a matching CSRF
// cookie sitting next to it. The one edge case is a refresh_token cookie
// that predates this feature being deployed (no matching csrf_token yet);
// that session simply needs one fresh login, which is an acceptable,
// self-healing one-time cost for closing this CSRF gap on this route.
router.post("/refresh", requireCsrf, async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: "No active session." });

    const tokenHash = hashToken(token);
    const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash }).select("+refreshTokens");
    const entry = user?.refreshTokens.find((t) => t.tokenHash === tokenHash);

    if (!user || !entry || entry.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    const accessToken = await issueTokens(res, user, req);
    res.json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    console.error("Refresh failed:", err);
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
});

// POST /api/auth/forgot-password  { email }
router.post("/forgot-password", authLimiter, async (req, res) => {
  const generic = { ok: true, message: "If an account exists for that email, a reset link has been sent." };
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(String(email))) return res.json(generic);

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.json(generic); // don't reveal whether the email exists

    const resetToken = generateOpaqueToken();
    user.passwordResetTokenHash = hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();
    const devLink = await sendPasswordResetEmail(user, resetToken);

    res.json({ ...generic, ...(isDev ? { devResetLink: devLink } : {}) });
  } catch (err) {
    console.error("Forgot-password failed:", err);
    res.json(generic);
  }
});

// POST /api/auth/reset-password  { token, password }
router.post("/reset-password", authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof token !== "string") return res.status(400).json({ error: "Reset token is required." });
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpires +refreshTokens");
    if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // force re-login on every device
    await user.save();

    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true, message: "Password updated. Please log in again." });
  } catch (err) {
    console.error("Reset-password failed:", err);
    res.status(500).json({ error: "Could not reset the password. Please try again." });
  }
});

// POST /api/auth/verify-email  { token }
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") return res.status(400).json({ error: "Verification token is required." });

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationTokenHash +emailVerificationExpires");
    if (!user) return res.status(400).json({ error: "This verification link is invalid or has expired." });

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ ok: true, message: "Email verified." });
  } catch (err) {
    console.error("Verify-email failed:", err);
    res.status(500).json({ error: "Could not verify email. Please try again." });
  }
});

// POST /api/auth/resend-verification
// The 20/15min authLimiter above is about cross-endpoint abuse; this
// separate 60s cooldown is a UX guard against a double-click resending two
// tokens in the same second (which would just invalidate the first).
const RESEND_VERIFICATION_COOLDOWN_MS = 60 * 1000;
router.post("/resend-verification", requireAuth, authLimiter, async (req, res) => {
  try {
    if (req.user.emailVerified) return res.json({ ok: true, message: "Email already verified." });

    const user = await User.findById(req.userId).select("+lastVerificationEmailSentAt");
    if (user.lastVerificationEmailSentAt) {
      const elapsed = Date.now() - user.lastVerificationEmailSentAt.getTime();
      if (elapsed < RESEND_VERIFICATION_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((RESEND_VERIFICATION_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ error: "Please wait before requesting another verification email.", retryAfterSeconds });
      }
    }

    const token = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    user.lastVerificationEmailSentAt = new Date();
    await user.save();
    const devLink = await sendVerificationEmail(user, token);

    res.json({ ok: true, ...(isDev ? { devVerificationLink: devLink } : {}) });
  } catch (err) {
    console.error("Resend-verification failed:", err);
    res.status(500).json({ error: "Could not resend the verification email." });
  }
});

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select("+passwordHash +refreshTokens");
    if (!user.passwordHash) {
      return res.status(400).json({ error: "This account doesn't have a password yet — it signs in with Google or GitHub." });
    }
    const match = await comparePassword(currentPassword || "", user.passwordHash);
    if (!match) return res.status(401).json({ error: "Current password is incorrect." });

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    user.passwordHash = await hashPassword(newPassword);
    user.refreshTokens = []; // force re-login everywhere else
    const accessToken = await issueTokens(res, user, req); // keep this session alive
    res.json({ ok: true, accessToken });
  } catch (err) {
    console.error("Change-password failed:", err);
    res.status(500).json({ error: "Could not change the password." });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const [packageCount, storageAgg] = await Promise.all([
      StudyPackage.countDocuments({ owner: req.userId }),
      StudyPackage.aggregate([
        { $match: { owner: req.userId } },
        { $project: { size: { $strLenCP: { $ifNull: ["$raw_transcript", ""] } } } },
        { $group: { _id: null, total: { $sum: "$size" } } },
      ]),
    ]);

    res.json({
      user: sanitizeUser(req.user),
      limits: planLimitsForClient(req.user.plan),
      usage: {
        packages: packageCount,
        storageChars: storageAgg[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error("Get me failed:", err);
    res.status(500).json({ error: "Could not load your account." });
  }
});

// PATCH /api/auth/me  { firstName, lastName }
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (firstName !== undefined || lastName !== undefined) {
      const nameError = validateFirstLast(firstName ?? req.user.firstName, lastName ?? req.user.lastName);
      if (nameError) return res.status(400).json({ error: nameError });
      if (firstName !== undefined) req.user.firstName = firstName.trim();
      if (lastName !== undefined) req.user.lastName = lastName.trim();
    }
    await req.user.save();
    res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    console.error("Update profile failed:", err);
    res.status(500).json({ error: "Could not update your profile." });
  }
});

// Every session route below needs to know which of the caller's sessions
// is "this one" — derived the same way POST /refresh identifies a session,
// by hashing the request's own refresh cookie and matching it against the
// already-loaded user's refreshTokens (requireAuth only verifies the
// Bearer access token; it doesn't tell us which refresh-token subdoc
// issued it, so this lookup is still needed even though the user is
// already authenticated by the time these routes run).
function currentSessionId(refreshCookieValue, user) {
  if (!refreshCookieValue) return null;
  const tokenHash = hashToken(refreshCookieValue);
  return user.refreshTokens?.find((t) => t.tokenHash === tokenHash)?.sessionId || null;
}

// GET /api/auth/sessions
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+refreshTokens");
    res.json({ sessions: listSessions(user, currentSessionId(req.cookies?.[REFRESH_COOKIE], user)) });
  } catch (err) {
    console.error("List sessions failed:", err);
    res.status(500).json({ error: "Could not load your sessions." });
  }
});

// DELETE /api/auth/sessions/:sessionId — revoke one specific session. If
// it's the caller's own current one, also clear their cookie (they're
// logged out of the tab they just did this from).
router.delete("/sessions/:sessionId", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+refreshTokens");
    const wasCurrent = currentSessionId(req.cookies?.[REFRESH_COOKIE], user) === req.params.sessionId;
    const removed = revokeSession(user, req.params.sessionId);
    if (!removed) return res.status(404).json({ error: "Session not found." });
    await user.save();
    if (wasCurrent) res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Revoke session failed:", err);
    res.status(500).json({ error: "Could not revoke that session." });
  }
});

// POST /api/auth/sessions/revoke-others — keeps the caller logged in here,
// logs out every other device/browser.
router.post("/sessions/revoke-others", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+refreshTokens");
    const sessionId = currentSessionId(req.cookies?.[REFRESH_COOKIE], user);
    revokeOtherSessions(user, sessionId);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("Revoke other sessions failed:", err);
    res.status(500).json({ error: "Could not log out other sessions." });
  }
});

// POST /api/auth/sessions/revoke-all — logs the caller out too (clears
// their own cookie), unlike revoke-others.
router.post("/sessions/revoke-all", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+refreshTokens");
    revokeAllSessions(user);
    await user.save();
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Revoke all sessions failed:", err);
    res.status(500).json({ error: "Could not log out all sessions." });
  }
});

// POST /api/auth/avatar — multipart/form-data, field name "avatar"
router.post("/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please choose an image file." });
    const oldPictureUrl = req.user.pictureUrl;
    req.user.pictureUrl = await saveAvatar(req.file.buffer);
    await req.user.save();
    await deleteAvatarIfOwned(oldPictureUrl);
    res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    console.error("Avatar upload failed:", err);
    res.status(500).json({ error: "Could not upload your avatar. Please try a different image." });
  }
});

// POST /api/auth/email  { newEmail, currentPassword } — starts an email
// change; `email` itself doesn't update until the new address is verified
// (see POST /verify-email-change below), so a typo'd or attacker-entered
// address can never lock the real owner out.
router.post("/email", requireAuth, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !validator.isEmail(String(newEmail))) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const user = await User.findById(req.userId).select("+passwordHash");
    if (!user.passwordHash) {
      return res.status(400).json({ error: "This account doesn't have a password yet — it signs in with Google or GitHub." });
    }
    const match = await comparePassword(currentPassword || "", user.passwordHash);
    if (!match) return res.status(401).json({ error: "Incorrect password." });

    const normalized = String(newEmail).trim().toLowerCase();
    if (normalized === user.email) return res.status(400).json({ error: "That's already your current email address." });
    const taken = await User.findOne({ email: normalized });
    if (taken) return res.status(409).json({ error: "An account with this email already exists." });

    const token = generateOpaqueToken();
    user.pendingEmail = normalized;
    user.pendingEmailTokenHash = hashToken(token);
    user.pendingEmailExpires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
    await user.save();
    const devLink = await sendEmailChangeVerification(user, normalized, token);

    res.json({ ok: true, ...(isDev ? { devEmailChangeLink: devLink } : {}) });
  } catch (err) {
    console.error("Email change request failed:", err);
    res.status(500).json({ error: "Could not start the email change. Please try again." });
  }
});

// POST /api/auth/verify-email-change  { token }
router.post("/verify-email-change", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") return res.status(400).json({ error: "Verification token is required." });

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      pendingEmailTokenHash: tokenHash,
      pendingEmailExpires: { $gt: new Date() },
    }).select("+pendingEmail +pendingEmailTokenHash +pendingEmailExpires");
    if (!user) return res.status(400).json({ error: "This verification link is invalid or has expired." });

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.pendingEmailTokenHash = undefined;
    user.pendingEmailExpires = undefined;
    await user.save();

    res.json({ ok: true, message: "Email address updated." });
  } catch (err) {
    console.error("Verify-email-change failed:", err);
    res.status(500).json({ error: "Could not update your email. Please try again." });
  }
});

// GET /api/auth/connected-accounts
router.get("/connected-accounts", requireAuth, async (req, res) => {
  try {
    // req.user (from requireAuth) never has passwordHash loaded — it's
    // select:false and requireAuth's lookup doesn't ask for it — so it must
    // be re-fetched explicitly here, or hasPassword would always read false
    // regardless of whether the user actually has one set.
    const user = await User.findById(req.userId).select("+passwordHash");
    res.json({
      connectedAccounts: user.connectedAccounts.map((a) => ({ provider: a.provider, email: a.email, connectedAt: a.connectedAt })),
      hasPassword: Boolean(user.passwordHash),
    });
  } catch (err) {
    console.error("List connected accounts failed:", err);
    res.status(500).json({ error: "Could not load your connected accounts." });
  }
});

// DELETE /api/auth/connected-accounts/:provider — guard: never leave zero
// login methods. A user with a password can always unlink every provider;
// an OAuth-only user must keep at least one provider linked.
router.delete("/connected-accounts/:provider", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("+passwordHash");
    const remaining = user.connectedAccounts.filter((a) => a.provider !== req.params.provider);
    if (remaining.length === user.connectedAccounts.length) {
      return res.status(404).json({ error: "That provider isn't connected." });
    }
    if (!user.passwordHash && remaining.length === 0) {
      return res.status(400).json({ error: "You need at least one way to sign in — set a password or keep another provider connected." });
    }
    user.connectedAccounts = remaining;
    await user.save();
    res.json({ connectedAccounts: user.connectedAccounts.map((a) => ({ provider: a.provider, email: a.email, connectedAt: a.connectedAt })) });
  } catch (err) {
    console.error("Disconnect provider failed:", err);
    res.status(500).json({ error: "Could not disconnect that provider." });
  }
});

// GET /api/auth/export-data — profile + owned StudyPackage metadata only
// (title/createdAt/sourceType), not full generated content — a reasonable
// scope for a personal-data export without re-serializing every generated
// study package.
router.get("/export-data", requireAuth, async (req, res) => {
  try {
    const packages = await StudyPackage.find({ owner: req.userId }).select("metadata.video_title createdAt source.type").lean();
    const exportData = {
      profile: {
        ...sanitizeUser(req.user),
        connectedAccounts: req.user.connectedAccounts.map((a) => ({ provider: a.provider, email: a.email, connectedAt: a.connectedAt })),
      },
      studyPackages: packages.map((p) => ({ title: p.metadata?.video_title, createdAt: p.createdAt, sourceType: p.source?.type })),
    };
    res.setHeader("Content-Disposition", 'attachment; filename="lectureai-export.json"');
    res.json(exportData);
  } catch (err) {
    console.error("Export data failed:", err);
    res.status(500).json({ error: "Could not export your data. Please try again." });
  }
});

// DELETE /api/auth/me  { password } — schedules the account (and everything
// it owns) for permanent deletion in 30 days (see services/auth/deletion.js
// for the actual purge). Deliberately does NOT delete anything immediately,
// clear the session, or log the user out — the spec allows continued login
// during the window so they can change their mind via POST /reactivate.
router.delete("/me", requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.userId).select("+passwordHash");
    if (user.passwordHash) {
      const match = await comparePassword(password || "", user.passwordHash);
      if (!match) return res.status(401).json({ error: "Incorrect password." });
    }
    // An OAuth-only account has no password to confirm with — proceeding
    // without one is acceptable here because deletion still requires an
    // authenticated session (requireAuth), which is itself the real gate.

    user.deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ ok: true, deletionScheduledAt: user.deletionScheduledAt });
  } catch (err) {
    console.error("Delete account failed:", err);
    res.status(500).json({ error: "Could not delete your account." });
  }
});

// POST /api/auth/reactivate — cancels a pending deletion scheduled above.
router.post("/reactivate", requireAuth, async (req, res) => {
  try {
    if (!req.user.deletionScheduledAt) {
      return res.status(400).json({ error: "Your account isn't scheduled for deletion." });
    }
    req.user.deletionScheduledAt = null;
    await req.user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("Reactivate account failed:", err);
    res.status(500).json({ error: "Could not reactivate your account." });
  }
});

// The old POST /api/auth/upgrade directly flipped req.user.plan with no
// payment involved — a real payment processor is wired up now (see
// routes/billing.js: /checkout starts a subscription, /portal manages an
// existing one), so that stub is gone. Leaving it in would let anyone grant
// themselves "pro" for free with a single authenticated request.

export default router;
