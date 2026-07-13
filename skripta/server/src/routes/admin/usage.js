import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import { getAiUsageStats, getFileStorageStats, getGenerationStats } from "../../services/admin/usageStats.js";

const router = Router();

// GET /api/admin/usage/ai
router.get("/ai", async (_req, res) => {
  try {
    res.json(await getAiUsageStats());
  } catch (err) {
    console.error("Admin AI usage stats failed:", err);
    respondError(res, err, "Could not load AI usage stats.");
  }
});

// GET /api/admin/usage/files
router.get("/files", async (_req, res) => {
  try {
    res.json(await getFileStorageStats());
  } catch (err) {
    console.error("Admin file/storage stats failed:", err);
    respondError(res, err, "Could not load file/storage stats.");
  }
});

// GET /api/admin/usage/generations
router.get("/generations", async (_req, res) => {
  try {
    res.json(await getGenerationStats());
  } catch (err) {
    console.error("Admin generation stats failed:", err);
    respondError(res, err, "Could not load generation stats.");
  }
});

export default router;
