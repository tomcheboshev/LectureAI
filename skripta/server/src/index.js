import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import oauthRouter from "./routes/oauth.js";
import packagesRouter from "./routes/packages.js";
import chatRouter from "./routes/chat.js";
import analyticsRouter from "./routes/analytics.js";
import billingRouter from "./routes/billing.js";
import billingWebhookRouter from "./routes/billingWebhook.js";
import referralsRouter from "./routes/referrals.js";
import adminRouter from "./routes/admin/index.js";
import supportRouter from "./routes/support.js";
import contactRouter from "./routes/contact.js";
import ogRouter from "./routes/og.js";
import { reconcileStrandedJobs } from "./services/reconcileJobs.js";
import { purgeExpiredDeletions } from "./services/auth/deletion.js";
import { logError } from "./utils/logger.js";

// Without these, Node's default behavior for an unhandled promise rejection
// anywhere in the process — a missed .catch() in a fire-and-forget call, an
// error thrown inside a library's internal async code, ... — is to crash
// the ENTIRE process immediately. That doesn't just fail the one request
// that caused it: the background job queue (jobQueue.js) holds every other
// user's in-flight generation in memory, so a single unhandled rejection
// anywhere kills every generation currently running for every user at
// once. `node --watch` then silently restarts the process, which masks the
// crash (no visible downtime, just every in-flight package left stuck until
// reconcileStrandedJobs() marks it failed on the next startup) unless
// someone happens to be watching the terminal output. Log loudly and keep
// serving instead — an unhandled rejection is a bug to fix, not a reason to
// take down every other user's work.
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION (process kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION (process kept alive):", err);
});

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

// CLIENT_ORIGIN lets production deployments lock CORS to the real frontend;
// left unset, it reflects the request's own origin (needed for local dev,
// still safe since it's paired with credentials rather than a "*" wildcard).
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);
app.use(cookieParser());

// Stripe webhook signature verification needs the EXACT raw request bytes —
// must be mounted with express.raw() before the global express.json()
// below, or by the time it reaches the handler the body has already been
// parsed and re-serialized, which no longer byte-for-byte matches what
// Stripe signed and would fail verification on every single delivery.
app.use("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookRouter);

app.use(express.json({ limit: "2mb" }));

// Broad safety net against abuse/scraping; auth routes layer a tighter
// limiter of their own on top of this.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Serves uploaded avatars (server/uploads/avatars/<file>.webp, see
// services/auth/avatars.js) — the only persisted-to-disk user content in
// this app. Not rate-limited above like /api since it's plain static asset
// serving, not an API surface.
app.use("/uploads", express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "../uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/auth/oauth", oauthRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/referrals", referralsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);
app.use("/api/contact", contactRouter);
app.use("/api/og", ogRouter);

// Opt-in (not NODE_ENV-gated) so the local two-process dev setup — Vite on
// :5173 proxying /api to this server on :3000 — is completely unaffected
// unless this is explicitly turned on. When enabled, serves the client's
// prerendered build: express.static's default index:true resolves clean
// URLs like /features straight to dist/features/index.html (written by
// client/scripts/prerender.mjs); any route with no prerendered file (e.g.
// /dashboard) falls through to the catch-all below, serving the plain CSR
// shell so client-side routing takes over.
if (process.env.SERVE_CLIENT === "true") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const CLIENT_DIST = path.join(__dirname, "../../client/dist");
  app.use(express.static(CLIENT_DIST));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) return next(); // let a mistyped API path fall through to the JSON 404 below, not the SPA shell
    // app-shell.html (not index.html) — index.html IS the prerendered
    // landing page for "/", and serving that as the fallback for e.g.
    // /dashboard would flash the wrong title/content before client JS
    // reroutes. app-shell.html is a page-agnostic copy of the same bare
    // template, preserved by prerender.mjs before "/" overwrites index.html.
    res.sendFile(path.join(CLIENT_DIST, "app-shell.html"));
  });
}

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Centralized error handler so malformed JSON bodies and unhandled route
// errors return JSON instead of Express's default HTML error page.
app.use((err, req, res, _next) => {
  logError(err, { route: req.path, method: req.method });
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File is too large for your plan." });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Too many files for your plan." });
  }
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Study";

async function start() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("WARNING: OPENROUTER_API_KEY is not set — generation and chat will fail.");
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("WARNING: STRIPE_SECRET_KEY is not set — checkout and billing portal will fail.");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("WARNING: STRIPE_WEBHOOK_SECRET is not set — subscription status will never sync from Stripe.");
  }
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see .env.example).");
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("WARNING: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — 'Continue with Google' will be hidden.");
  }
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("WARNING: GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET not set — 'Continue with GitHub' will be hidden.");
  }
  if (!process.env.OAUTH_STATE_SECRET) {
    console.warn("WARNING: OAUTH_STATE_SECRET is not set — any OAuth login attempt will fail even if a provider is configured.");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected:", MONGODB_URI);
  await reconcileStrandedJobs();

  // Same "no dedicated job runner, do maintenance work in the long-lived
  // Node process" posture as reconcileStrandedJobs() above, just recurring
  // instead of once — a scheduled-for-deletion account must actually get
  // purged even if nothing else ever triggers a check for it.
  await purgeExpiredDeletions().catch((err) => console.error("Initial purge-expired-deletions failed:", err));
  setInterval(() => {
    purgeExpiredDeletions().catch((err) => console.error("Scheduled purge-expired-deletions failed:", err));
  }, 60 * 60 * 1000);

  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
