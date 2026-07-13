import { Router } from "express";
import { respondError } from "../../utils/httpError.js";
import SupportTicket from "../../models/SupportTicket.js";
import AdminActionLog from "../../models/AdminActionLog.js";

const router = Router();

// GET /api/admin/support?status=&page=&limit=
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
    ]);

    res.json({ tickets, total, page, limit });
  } catch (err) {
    console.error("Admin support list failed:", err);
    respondError(res, err, "Could not load support tickets.");
  }
});

// GET /api/admin/support/:id
router.get("/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate("owner", "name email").populate("internalNotes.admin", "name").lean();
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });
    res.json({ ticket });
  } catch (err) {
    console.error("Admin support detail failed:", err);
    respondError(res, err, "Could not load this ticket.");
  }
});

// PATCH /api/admin/support/:id  { status?, priority? }
router.patch("/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });

    const { status, priority } = req.body;
    if (status !== undefined) {
      if (!["open", "in_progress", "resolved", "closed"].includes(status)) return res.status(400).json({ error: "Invalid status." });
      ticket.status = status;
      ticket.resolvedAt = status === "resolved" ? new Date() : ticket.resolvedAt;
    }
    if (priority !== undefined) {
      if (!["low", "normal", "high"].includes(priority)) return res.status(400).json({ error: "Invalid priority." });
      ticket.priority = priority;
    }
    await ticket.save();
    await AdminActionLog.create({ admin: req.user._id, action: "ticket_updated", targetType: "SupportTicket", targetId: ticket._id, detail: { status, priority } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin support update failed:", err);
    respondError(res, err, "Could not update this ticket.");
  }
});

// POST /api/admin/support/:id/notes  { note }
router.post("/:id/notes", async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || typeof note !== "string" || !note.trim()) return res.status(400).json({ error: "Note text is required." });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });

    ticket.internalNotes.push({ admin: req.user._id, note: note.trim() });
    await ticket.save();
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin support add-note failed:", err);
    respondError(res, err, "Could not add this note.");
  }
});

export default router;
