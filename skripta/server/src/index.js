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

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Centralized error handler so malformed JSON bodies and unhandled route
// errors return JSON instead of Express's default HTML error page.
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
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
const MONGODB_URI = "mongodb://127.0.0.1:27017/Study";

async function start() {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set — generation and chat will fail.");
  }
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set (see .env.example).");
  }

  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected:", MONGODB_URI);
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
