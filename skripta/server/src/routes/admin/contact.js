import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import ContactMessage from "../../models/ContactMessage.js";

const router = Router();

// GET /api/admin/contact?status=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [messages, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ContactMessage.countDocuments(filter),
    ]);

    res.json({ messages, total, page, limit });
  } catch (err) {
    console.error("Admin contact list failed:", err);
    respondError(res, err, "Could not load contact messages.");
  }
});

// GET /api/admin/contact/:id
router.get("/:id", async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id).lean();
    if (!message) return res.status(404).json({ error: "Message not found." });
    res.json({ message });
  } catch (err) {
    console.error("Admin contact detail failed:", err);
    respondError(res, err, "Could not load this message.");
  }
});

// PATCH /api/admin/contact/:id  { status?, adminNotes? }
router.patch("/:id", async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "Message not found." });

    const { status, adminNotes } = req.body;
    if (status !== undefined) {
      if (!["new", "read", "responded", "archived"].includes(status)) return res.status(400).json({ error: "Invalid status." });
      message.status = status;
    }
    if (adminNotes !== undefined) message.adminNotes = adminNotes;
    await message.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin contact update failed:", err);
    respondError(res, err, "Could not update this message.");
  }
});

export default router;
