import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — "remember me" checked
// Not remembered: the server-side session still caps out at 1 day even if
// the browser itself is left open longer (the cookie is also issued
// without `maxAge` in this case, making it a browser-session cookie — the
// two mechanisms are independent layers, not redundant).
export const REFRESH_TOKEN_TTL_MS_SHORT = 24 * 60 * 60 * 1000; // 1 day — "remember me" unchecked
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 1 hour

function accessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set.");
  return secret;
}

function pepper() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set.");
  return secret;
}

export function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId) }, accessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, accessSecret());
}

// Refresh tokens, email-verification tokens and password-reset tokens are
// all opaque random strings sent to the client and looked up by their
// (peppered) hash in the DB — never stored or logged in plaintext, and a
// single token can be revoked without invalidating the others.
export function generateOpaqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHmac("sha256", pepper()).update(token).digest("hex");
}
