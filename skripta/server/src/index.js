import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import packagesRouter from "./routes/packages.js";
import chatRouter from "./routes/chat.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/packages", packagesRouter);
app.use("/api/chat", chatRouter);

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
