import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import SupportTicket from "../models/SupportTicket.js";

const router = Router();
router.use(requireAuth);

function validateTicketInput(subject, body) {
  if (!subject || typeof subject !== "string" || !subject.trim()) return "Subject is required.";
  if (subject.trim().length > 200) return "Subject is too long.";
  if (!body || typeof body !== "string" || !body.trim()) return "A description is required.";
  if (body.trim().length > 5000) return "Description is too long.";
  return null;
}

// POST /api/support  { subject, body, priority? }
router.post("/", async (req, res) => {
  try {
    const { subject, body, priority } = req.body;
    const validationError = validateTicketInput(subject, body);
    if (validationError) return res.status(400).json({ error: validationError });

    const ticket = await SupportTicket.create({
      owner: req.userId,
      subject: subject.trim(),
      body: body.trim(),
      priority: ["low", "normal", "high"].includes(priority) ? priority : "normal",
    });
    res.status(201).json({ ticket });
  } catch (err) {
    console.error("Create support ticket failed:", err);
    res.status(500).json({ error: "Could not submit your ticket. Please try again." });
  }
});

// GET /api/support — own tickets, status-only (no internalNotes)
router.get("/", async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ owner: req.userId }, "-internalNotes").sort({ createdAt: -1 }).lean();
    res.json({ tickets });
  } catch (err) {
    console.error("List support tickets failed:", err);
    res.status(500).json({ error: "Could not load your tickets." });
  }
});

// GET /api/support/:id — own ticket, status-only
router.get("/:id", async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, owner: req.userId }, "-internalNotes").lean();
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });
    res.json({ ticket });
  } catch (err) {
    console.error("Get support ticket failed:", err);
    res.status(500).json({ error: "Could not load this ticket." });
  }
});

export default router;
