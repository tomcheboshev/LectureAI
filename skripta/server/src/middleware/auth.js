import { verifyAccessToken } from "../services/auth/tokens.js";
import User from "../models/User.js";
import { syncEffectivePlan } from "../services/billing/subscription.js";

function extractToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

// Attaches req.userId (from the JWT) and req.user (the loaded document,
// minus sensitive fields) to every request on a protected route.
export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required." });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    if (user.banned) return res.status(403).json({ error: "Your account has been suspended.", reason: "account_banned" });

    // Lazily expires a "pro" plan whose grace period has lapsed — see
    // syncEffectivePlan's own comment for why this replaces a cron job.
    await syncEffectivePlan(user);

    req.userId = user._id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
