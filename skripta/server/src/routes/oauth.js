import { Router } from "express";
import crypto from "crypto";
import User from "../models/User.js";
import { hashToken } from "../services/auth/tokens.js";
import { PROVIDERS, isProviderConfigured, buildAuthorizeUrl, exchangeCode, fetchUserinfo, signState, verifyState } from "../services/auth/oauth.js";
import { issueTokens } from "./auth.js";

const router = Router();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const REFRESH_COOKIE = "refresh_token";
const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough to complete the provider's own login page

function errorRedirect(res, reason) {
  return res.redirect(`${CLIENT_URL}/oauth/callback?status=error&reason=${encodeURIComponent(reason)}`);
}

// GET /api/auth/oauth/providers — lets the client show/hide each button
// without hardcoding which providers happen to have credentials configured
// in this environment.
router.get("/providers", (_req, res) => {
  res.json({ google: isProviderConfigured("google"), github: isProviderConfigured("github") });
});

// GET /api/auth/oauth/:provider[?intent=link] — real browser navigation
// (an <a href>, never fetch/XHR), so there's no Authorization header to
// read here even for the "link an additional provider to my logged-in
// account" case. Identify the caller (when intent=link) the same way
// POST /refresh does: by looking up the httpOnly refresh_token cookie,
// which — unlike the in-memory access token — IS sent automatically on
// this request since it's scoped to path "/api/auth" (a superset of
// "/api/auth/oauth").
router.get("/:provider", async (req, res) => {
  const { provider } = req.params;
  try {
    if (!PROVIDERS[provider]) return errorRedirect(res, "unknown_provider");
    if (!isProviderConfigured(provider)) return errorRedirect(res, "not_configured");

    const intent = req.query.intent === "link" ? "link" : "login";
    let userId;
    if (intent === "link") {
      const token = req.cookies?.[REFRESH_COOKIE];
      const user = token && (await User.findOne({ "refreshTokens.tokenHash": hashToken(token) }));
      if (!user) return errorRedirect(res, "not_authenticated");
      userId = String(user._id);
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const state = signState({ nonce, provider, intent, ...(userId ? { userId } : {}) });
    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/oauth",
      maxAge: OAUTH_STATE_TTL_MS,
    });
    res.redirect(buildAuthorizeUrl(provider, state));
  } catch (err) {
    // Covers e.g. OAUTH_STATE_SECRET missing even though the provider's own
    // client id/secret are configured — signState() throws in that case.
    console.error(`OAuth ${provider} initiation failed:`, err);
    errorRedirect(res, "server_error");
  }
});

// GET /api/auth/oauth/:provider/callback — the provider redirects the
// browser back here with ?code&state. Every outcome (success or failure)
// ends in a redirect back to the SPA, never a JSON response — this is a
// full-page navigation, not an API call the client's JS is waiting on.
router.get("/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  try {
    if (!PROVIDERS[provider]) return errorRedirect(res, "unknown_provider");
    if (!isProviderConfigured(provider)) return errorRedirect(res, "not_configured");
    if (req.query.error) return errorRedirect(res, "provider_denied");

    const stateCookie = req.cookies?.[OAUTH_STATE_COOKIE];
    const statePayload = verifyState(req.query.state);
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth/oauth" });
    if (!statePayload || !stateCookie || statePayload.nonce !== stateCookie || statePayload.provider !== provider) {
      return errorRedirect(res, "invalid_state");
    }

    const providerAccessToken = await exchangeCode(provider, req.query.code);
    const profile = await fetchUserinfo(provider, providerAccessToken);
    if (!profile.email) return errorRedirect(res, "no_email");

    let user;

    if (statePayload.intent === "link") {
      // Identified from the signed state's userId (set only when this flow
      // was initiated by an already-authenticated "Connect" click) — never
      // from the provider's own email. Trusting the provider's email here
      // instead would let a logged-in attacker link (and thereby gain a
      // login method into) a DIFFERENT existing account just because that
      // account's email happens to match whatever the attacker's Google/
      // GitHub profile reports.
      // +refreshTokens is required here — issueTokens() below reads/mutates
      // it, and without selecting it Mongoose treats the field as unloaded
      // (undefined), which makes issueTokens() replace the WHOLE array
      // instead of appending, silently logging out every other device (see
      // the identical note on the password-login route for the full story).
      user = await User.findById(statePayload.userId).select("+refreshTokens");
      if (!user) return errorRedirect(res, "account_not_found");

      const claimedElsewhere = await User.findOne({ "connectedAccounts.provider": provider, "connectedAccounts.providerAccountId": profile.providerAccountId });
      if (claimedElsewhere && String(claimedElsewhere._id) !== String(user._id)) {
        return errorRedirect(res, "already_linked_elsewhere");
      }
      if (!user.connectedAccounts.some((a) => a.provider === provider)) {
        user.connectedAccounts.push({ provider, providerAccountId: profile.providerAccountId, email: profile.email });
      }
    } else {
      // Normal login/register flow. Lookup order: (1) an existing link by
      // provider+providerAccountId — the common "logging in again" case.
      // (2) no link yet, but a User already exists with this email AND the
      // provider reports that email as verified — auto-link. Verification
      // is required here specifically to prevent account takeover: without
      // it, an attacker could register an unverified email at Google/GitHub
      // matching a victim's LectureAI address and get logged into the
      // victim's account. (3) no match at all — create a brand-new account;
      // emailVerified is set true since the provider already verified it.
      user = await User.findOne({ "connectedAccounts.provider": provider, "connectedAccounts.providerAccountId": profile.providerAccountId }).select(
        "+refreshTokens"
      );

      if (!user) {
        const existingByEmail = await User.findOne({ email: profile.email.toLowerCase() }).select("+refreshTokens");
        if (existingByEmail) {
          if (!profile.emailVerified) return errorRedirect(res, "email_not_verified");
          existingByEmail.connectedAccounts.push({ provider, providerAccountId: profile.providerAccountId, email: profile.email });
          user = existingByEmail;
        } else {
          user = new User({
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email.toLowerCase(),
            pictureUrl: profile.pictureUrl,
            emailVerified: true,
            connectedAccounts: [{ provider, providerAccountId: profile.providerAccountId, email: profile.email }],
          });
        }
      }
    }

    if (user.banned) return errorRedirect(res, "account_banned");
    await user.save();

    // Social login always behaves like "remember me" checked — there's no
    // equivalent checkbox in this flow, and staying signed in is the
    // expected default for social login on comparable SaaS products.
    await issueTokens(res, user, req, { rememberMe: true });
    res.redirect(`${CLIENT_URL}/oauth/callback?status=success`);
  } catch (err) {
    console.error(`OAuth ${provider} callback failed:`, err);
    errorRedirect(res, "server_error");
  }
});

export default router;
