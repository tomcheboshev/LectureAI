import { Router } from "express";
import rateLimit from "express-rate-limit";
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
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "../services/auth/tokens.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/auth/email.js";
import { logError } from "../utils/logger.js";

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
    email: user.email,
    role: user.role,
    plan: user.plan,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

async function issueTokens(res, user, req) {
  const accessToken = signAccessToken(user._id);
  const refreshToken = generateOpaqueToken();

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    userAgent: req.headers["user-agent"]?.slice(0, 200),
  });
  // Cap concurrent sessions per account instead of growing unbounded.
  if (user.refreshTokens.length > 10) user.refreshTokens = user.refreshTokens.slice(-10);
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, { ...REFRESH_COOKIE_OPTS, maxAge: REFRESH_TOKEN_TTL_MS });
  return accessToken;
}

function validateName(name) {
  if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
    return "Name is required (max 100 characters).";
  }
  return null;
}

// POST /api/auth/register  { name, email, password }
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ error: nameError });
    if (!email || !validator.isEmail(String(email))) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

    const verificationToken = generateOpaqueToken();
    user.emailVerificationTokenHash = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
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

// POST /api/auth/login  { email, password }
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+passwordHash");
    const match = user && (await comparePassword(password, user.passwordHash));
    if (!match) return res.status(401).json({ error: "Invalid email or password." });
    // Defense in depth: requireAuth already blocks banned users on every
    // subsequent request, but this stops a banned user from even minting a
    // fresh token in the first place.
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended.", reason: "account_banned" });

    const accessToken = await issueTokens(res, user, req);
    res.json({ user: sanitizeUser(user), accessToken });
  } catch (err) {
    logError(err, { route: "login" });
    respondError(res, err, "Login failed. Please try again.");
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const tokenHash = hashToken(token);
    await User.updateOne({ "refreshTokens.tokenHash": tokenHash }, { $pull: { refreshTokens: { tokenHash } } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ ok: true });
});

// POST /api/auth/refresh — rotates the refresh token and issues a new access token
router.post("/refresh", async (req, res) => {
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
router.post("/resend-verification", requireAuth, authLimiter, async (req, res) => {
  try {
    if (req.user.emailVerified) return res.json({ ok: true, message: "Email already verified." });

    const token = generateOpaqueToken();
    req.user.emailVerificationTokenHash = hashToken(token);
    req.user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    await req.user.save();
    const devLink = await sendVerificationEmail(req.user, token);

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

// PATCH /api/auth/me  { name }
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (name !== undefined) {
      const nameError = validateName(name);
      if (nameError) return res.status(400).json({ error: nameError });
      req.user.name = name.trim();
    }
    await req.user.save();
    res.json({ user: sanitizeUser(req.user) });
  } catch (err) {
    console.error("Update profile failed:", err);
    res.status(500).json({ error: "Could not update your profile." });
  }
});

// DELETE /api/auth/me  { password } — deletes the account and every package it owns
router.delete("/me", requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.userId).select("+passwordHash");
    const match = await comparePassword(password || "", user.passwordHash);
    if (!match) return res.status(401).json({ error: "Incorrect password." });

    await StudyPackage.deleteMany({ owner: req.userId });
    await User.deleteOne({ _id: req.userId });

    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete account failed:", err);
    res.status(500).json({ error: "Could not delete your account." });
  }
});

// The old POST /api/auth/upgrade directly flipped req.user.plan with no
// payment involved — a real payment processor is wired up now (see
// routes/billing.js: /checkout starts a subscription, /portal manages an
// existing one), so that stub is gone. Leaving it in would let anyone grant
// themselves "pro" for free with a single authenticated request.

export default router;
