import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import usersRouter from "./users.js";
import overviewRouter from "./overview.js";
import usageRouter from "./usage.js";
import systemRouter from "./system.js";
import supportRouter from "./support.js";
import contactRouter from "./contact.js";
import couponsRouter from "./coupons.js";
import reportsRouter from "./reports.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.use("/users", usersRouter);
router.use("/overview", overviewRouter);
router.use("/usage", usageRouter);
router.use("/system", systemRouter);
router.use("/support", supportRouter);
router.use("/contact", contactRouter);
router.use("/coupons", couponsRouter);
router.use("/reports", reportsRouter);

router.get("/ping", (_req, res) => res.json({ ok: true }));

export default router;
