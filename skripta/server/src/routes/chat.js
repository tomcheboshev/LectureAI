import { Router } from "express";
import StudyPackage from "../models/StudyPackage.js";
import { chatAboutLecture } from "../ai/index.js";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { planLimits, upgradeError } from "../services/subscription.js";
import { recordActivity } from "../services/analytics/activity.js";

const router = Router();
router.use(requireAuth);

// GET /api/chat/:id — load the persisted conversation for this package
router.get("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }, "chat_history").lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json({ messages: doc.chat_history || [] });
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

// POST /api/chat/:id  { messages: [{role:"user"|"assistant", content:"..."}] }
router.post("/:id", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }
    // Basic sanitation: only allow role/content string pairs, cap length and history.
    const clean = messages
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0 &&
          m.content.length <= 4000
      )
      .slice(-20);
    if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
      return res.status(400).json({ error: "Last message must be from the user." });
    }

    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId });
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const limits = planLimits(req.user.plan);
    if (limits.maxChatMessagesPerPackage !== Infinity) {
      const sentCount = (doc.chat_history || []).filter((m) => m.role === "user").length;
      if (sentCount >= limits.maxChatMessagesPerPackage) {
        throw upgradeError(
          "chat_limit",
          `You've reached the ${limits.maxChatMessagesPerPackage}-message AI Tutor limit on the ${req.user.plan} plan for this study package. Upgrade to Pro for unlimited chat.`,
          { limit: limits.maxChatMessagesPerPackage, plan: req.user.plan }
        );
      }
    }

    const reply = await chatAboutLecture(doc, clean);

    doc.chat_history = [...clean, { role: "assistant", content: reply }].slice(-40);
    await doc.save();
    recordActivity(req.userId, "chatMessages");

    res.json({ reply });
  } catch (err) {
    console.error("Chat failed:", err);
    respondError(res, err, "Chat failed. Try again.");
  }
});

// DELETE /api/chat/:id — clear the persisted conversation
router.delete("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { chat_history: [] });
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

export default router;
