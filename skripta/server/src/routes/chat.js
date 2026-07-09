import { Router } from "express";
import StudyPackage from "../models/StudyPackage.js";
// Промена: Го менуваме импортот кон новата gemini.js услуга
import { chatAboutLecture } from "../services/gemini.js";

const router = Router();

// GET /api/chat/:id — load the persisted conversation for this package
router.get("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findById(req.params.id, "chat_history").lean();
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

    const doc = await StudyPackage.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const reply = await chatAboutLecture(doc, clean);

    doc.chat_history = [...clean, { role: "assistant", content: reply }].slice(-40);
    await doc.save();

    res.json({ reply });
  } catch (err) {
    console.error("Chat failed:", err);
    res.status(err.status || 500).json({ error: err.userFacing ? err.message : "Chat failed. Try again." });
  }
});

// DELETE /api/chat/:id — clear the persisted conversation
router.delete("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findByIdAndUpdate(req.params.id, { chat_history: [] });
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

export default router;
