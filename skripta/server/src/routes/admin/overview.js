import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import { getOverviewStats } from "../../services/admin/revenue.js";

const router = Router();

// GET /api/admin/overview
router.get("/", async (_req, res) => {
  try {
    const stats = await getOverviewStats();
    res.json(stats);
  } catch (err) {
    console.error("Admin overview failed:", err);
    respondError(res, err, "Could not load overview stats.");
  }
});

export default router;
