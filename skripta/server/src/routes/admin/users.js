import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import { searchUsers, getUserDetail, banUser, unbanUser, softDeleteUser, overrideSubscription } from "../../services/admin/userAdmin.js";

const router = Router();

// GET /api/admin/users?q=&plan=&banned=&role=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const result = await searchUsers(req.query);
    res.json(result);
  } catch (err) {
    console.error("Admin user search failed:", err);
    respondError(res, err, "Could not search users.");
  }
});

// GET /api/admin/users/:id
router.get("/:id", async (req, res) => {
  try {
    const detail = await getUserDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "User not found." });
    res.json(detail);
  } catch (err) {
    console.error("Admin user detail failed:", err);
    respondError(res, err, "Could not load this user.");
  }
});

// POST /api/admin/users/:id/ban  { reason }
router.post("/:id/ban", async (req, res) => {
  try {
    const user = await banUser(req.user, req.params.id, req.body?.reason);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin ban failed:", err);
    respondError(res, err, "Could not ban this user.");
  }
});

// POST /api/admin/users/:id/unban
router.post("/:id/unban", async (req, res) => {
  try {
    const user = await unbanUser(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin unban failed:", err);
    respondError(res, err, "Could not unban this user.");
  }
});

// DELETE /api/admin/users/:id — soft-delete/anonymize, see userAdmin.js
router.delete("/:id", async (req, res) => {
  try {
    const user = await softDeleteUser(req.user, req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin delete failed:", err);
    respondError(res, err, "Could not delete this user.");
  }
});

// PATCH /api/admin/users/:id/subscription  { plan?, subscriptionStatus? }
// Local override only — does not call Stripe. See overrideSubscription's
// own comment for why a future webhook can still overwrite this.
router.patch("/:id/subscription", async (req, res) => {
  try {
    const user = await overrideSubscription(req.user, req.params.id, req.body || {});
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin subscription override failed:", err);
    respondError(res, err, "Could not update this user's subscription.");
  }
});

export default router;
