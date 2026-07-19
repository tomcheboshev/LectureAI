import crypto from "crypto";

// Hand-rolled OAuth2 authorization-code flow for Google + GitHub — no
// `passport` (this codebase consistently avoids framework abstractions;
// passport's strategy packages also want Express session middleware, which
// this app deliberately doesn't have since sessions live in Mongo via
// User.refreshTokens, not an in-memory/store-backed express-session).
export const PROVIDERS = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userinfoUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    scope: "read:user user:email",
    clientId: () => process.env.GITHUB_CLIENT_ID,
    clientSecret: () => process.env.GITHUB_CLIENT_SECRET,
  },
};

export function isProviderConfigured(provider) {
  const cfg = PROVIDERS[provider];
  return Boolean(cfg && cfg.clientId() && cfg.clientSecret());
}

function redirectUri(provider) {
  const base = process.env.API_PUBLIC_URL || "http://localhost:3000";
  return `${base}/api/auth/oauth/${provider}/callback`;
}

export function buildAuthorizeUrl(provider, state) {
  const cfg = PROVIDERS[provider];
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    redirect_uri: redirectUri(provider),
    scope: cfg.scope,
    state,
    response_type: "code",
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

export async function exchangeCode(provider, code) {
  const cfg = PROVIDERS[provider];
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      code,
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`${provider} token exchange failed (${res.status}).`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`${provider} token exchange returned no access_token.`);
  return data.access_token;
}

// Normalizes each provider's differently-shaped profile into one common
// shape — the OAuth route handler never needs to know which provider it's
// dealing with past this point.
export async function fetchUserinfo(provider, accessToken) {
  const cfg = PROVIDERS[provider];
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "LectureAI" };

  if (provider === "google") {
    const res = await fetch(cfg.userinfoUrl, { headers });
    if (!res.ok) throw new Error(`Google userinfo fetch failed (${res.status}).`);
    const p = await res.json();
    return {
      providerAccountId: p.sub,
      email: p.email || null,
      emailVerified: Boolean(p.email_verified),
      firstName: p.given_name || p.name?.split(" ")[0] || "Google",
      lastName: p.family_name || p.name?.split(" ").slice(1).join(" ") || "User",
      pictureUrl: p.picture || null,
    };
  }

  // github
  const res = await fetch(cfg.userinfoUrl, { headers });
  if (!res.ok) throw new Error(`GitHub userinfo fetch failed (${res.status}).`);
  const p = await res.json();

  // GitHub's /user endpoint only returns a public email if the user has one
  // set as public — otherwise it's null and a separate call (needing the
  // user:email scope) is required to find their verified primary address.
  let email = p.email;
  let emailVerified = Boolean(email);
  if (!email) {
    const emailsRes = await fetch(cfg.emailsUrl, { headers });
    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      const primary = emails.find((e) => e.primary) || emails[0];
      if (primary) {
        email = primary.email;
        emailVerified = Boolean(primary.verified);
      }
    }
  }

  const [firstName, ...rest] = (p.name || p.login || "GitHub User").split(" ");
  return {
    providerAccountId: String(p.id),
    email: email || null,
    emailVerified,
    firstName: firstName || "GitHub",
    lastName: rest.join(" ") || "User",
    pictureUrl: p.avatar_url || null,
  };
}

// Signed, stateless OAuth "state" parameter — embeds a nonce (cross-checked
// against a same-nonce httpOnly cookie set right before redirecting to the
// provider) plus where to send the user back to and, for the "connect an
// additional provider to my already-logged-in account" flow, which
// account this actually is (looked up from the signed payload, never
// trusted from the provider's own profile — see routes/oauth.js's comment
// on why that distinction matters for account-linking safety).
function secret() {
  const s = process.env.OAUTH_STATE_SECRET;
  if (!s) throw new Error("OAUTH_STATE_SECRET is not set.");
  return s;
}

export function signState(payload) {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}
