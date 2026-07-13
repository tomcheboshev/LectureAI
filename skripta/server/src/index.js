import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import packagesRouter from "./routes/packages.js";
import chatRouter from "./routes/chat.js";
import analyticsRouter from "./routes/analytics.js";
import billingRouter from "./routes/billing.js";
import billingWebhookRouter from "./routes/billingWebhook.js";
import adminRouter from "./routes/admin/index.js";
import supportRouter from "./routes/support.js";
import contactRouter from "./routes/contact.js";
import { reconcileStrandedJobs } from "./services/reconcileJobs.js";
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

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);
app.use("/api/contact", contactRouter);

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
  if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set — generation and chat will fail.");
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

  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected:", MONGODB_URI);
  await reconcileStrandedJobs();
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
