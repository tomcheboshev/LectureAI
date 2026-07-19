import crypto from "crypto";

// Scoped CSRF protection via the double-submit-cookie pattern — no
// server-side state store needed. This only matters for routes that mutate
// state using ONLY the refresh cookie (no Authorization header), since
// that's the one credential browsers attach automatically cross-site.
// Access-token-bearing requests are already immune to CSRF (a
// cross-site page has no way to read the in-memory access token to put it
// in an Authorization header), so this middleware is deliberately mounted
// on just POST /refresh and POST /logout in routes/auth.js — not app-wide.
const CSRF_COOKIE = "csrf_token";

// `maxAge` MUST mirror whatever the refresh cookie was just issued with
// (routes/auth.js's issueTokens) — if this cookie were always session-only
// while a "remember me" refresh cookie persists across browser restarts,
// the very next silent-refresh-on-boot after reopening the browser would
// have a refresh_token cookie but no csrf_token to echo back, 403-ing a
// perfectly legitimate request. Passing `undefined` here (not remembered)
// matches issueTokens' own session-cookie behavior for the refresh cookie.
export function issueCsrfCookie(res, maxAge) {
  const token = crypto.randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by client JS — that's the entire double-submit mechanism
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Deliberately path:"/" — NOT scoped to "/api/auth" like the refresh
    // cookie. A browser only exposes a cookie to document.cookie on pages
    // whose path is under the cookie's own path; since the SPA's pages live
    // at "/", "/login", "/dashboard", etc. (never under "/api/auth"),
    // scoping this cookie to "/api/auth" would make it invisible to the
    // client-side JS that needs to read and echo it back — defeating the
    // entire double-submit mechanism. Narrowing this cookie's path buys no
    // real security anyway (the token is meant to be JS-readable; the
    // protection comes from a cross-site attacker being unable to read it
    // due to same-origin policy, not from path scoping).
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  });
  return token;
}

export function requireCsrf(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}
