import { Router } from "express";
import mongoose from "mongoose";
import { respondError } from "../../utils/httpError.js";
import { getQueueStatus } from "../../services/jobQueue.js";
import ErrorLog from "../../models/ErrorLog.js";

const router = Router();

// GET /api/admin/system/queue
router.get("/queue", (_req, res) => {
  res.json(getQueueStatus());
});

// GET /api/admin/system/errors?level=&page=&limit=
router.get("/errors", async (req, res) => {
  try {
    const filter = {};
    if (req.query.level) filter.level = req.query.level;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [logs, total] = await Promise.all([
      ErrorLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ErrorLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    console.error("Admin error-log fetch failed:", err);
    respondError(res, err, "Could not load error logs.");
  }
});

// GET /api/admin/system/health — self-reported process metrics only; no
// external monitoring service, this is a self-hosted app with no separate
// infra to poll.
router.get("/health", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    database: {
      readyState: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
      connected: mongoose.connection.readyState === 1,
    },
    server: {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memoryRssMb: Math.round(mem.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    queue: getQueueStatus(),
    config: {
      aiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    },
  });
});

export default router;
