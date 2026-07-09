import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import packagesRouter from "./routes/packages.js";
import chatRouter from "./routes/chat.js";

const app = express();
// CLIENT_ORIGIN lets production deployments lock CORS to the real frontend;
// left unset, it stays open for local dev.
app.use(cors(process.env.CLIENT_ORIGIN ? { origin: process.env.CLIENT_ORIGIN } : {}));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
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
    return res.status(400).json({ error: "File is too large (max 20MB)." });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Too many files — you can upload at most 10 at once." });
  }
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/skripta";

async function start() {
  // Промена: Сега проверуваме за GEMINI_API_KEY наместо за ANTHROPIC_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not set — generation and chat will fail.");
  }
  
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected:", MONGODB_URI);
  app.listen(PORT, () => console.log(`Skripta API on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
