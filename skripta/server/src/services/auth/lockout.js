// Per-account brute-force lockout — distinct from and layered under the
// existing IP-based `authLimiter` (express-rate-limit) in routes/auth.js.
// The IP limiter stops high-volume abuse from one source; this stops
// unlimited password guesses against one specific account from many
// sources (e.g. a botnet), which an IP-scoped limiter alone can't catch.
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Returns true (and leaves the user untouched) if currently locked out.
// Callers should check this BEFORE calling bcrypt.compare — both to avoid
// the CPU cost and to keep the lockout state authoritative regardless of
// whether the attempted password happens to be correct.
export function checkLockout(user) {
  return Boolean(user.lockoutUntil && user.lockoutUntil > new Date());
}

// Call on a failed password match. Mutates the user in memory; caller is
// responsible for persisting (routes already call user.save() nearby).
export function recordFailedAttempt(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= LOGIN_MAX_ATTEMPTS) {
    user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
}

// Call on a successful login.
export function resetLockout(user) {
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
}
