import { Router } from "express";
import rateLimit from "express-rate-limit";
import validator from "validator";
import ContactMessage from "../models/ContactMessage.js";

const router = Router();

// This is the one genuinely public, unauthenticated write endpoint in the
// app — cap it tightly, mirroring routes/auth.js's authLimiter, since it's
// the obvious spam target.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again later." },
});

// POST /api/contact  { name, email, subject, message } — public, no auth
router.post("/", contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ error: "Name is required (max 100 characters)." });
    }
    if (!email || !validator.isEmail(String(email))) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    if (!subject || typeof subject !== "string" || !subject.trim() || subject.trim().length > 200) {
      return res.status(400).json({ error: "Subject is required (max 200 characters)." });
    }
    if (!message || typeof message !== "string" || !message.trim() || message.trim().length > 5000) {
      return res.status(400).json({ error: "Message is required (max 5000 characters)." });
    }

    await ContactMessage.create({
      name: name.trim(),
      email: String(email).trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Create contact message failed:", err);
    res.status(500).json({ error: "Could not send your message. Please try again." });
  }
});

export default router;
