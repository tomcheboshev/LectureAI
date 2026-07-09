import { verifyAccessToken } from "../services/auth/tokens.js";
import User from "../models/User.js";

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

    req.userId = user._id;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
