import { Router } from "express";
import StudyPackage from "../models/StudyPackage.js";
// Промена: Го менуваме импортот кон новата gemini.js услуга
import { chatAboutLecture } from "../services/gemini.js";

const router = Router();

// POST /api/chat/:id  { messages: [{role:"user"|"assistant", content:"..."}] }
router.post("/:id", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }
    // Basic sanitation: only allow role/content string pairs, cap history length.
    const clean = messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20);
    if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
      return res.status(400).json({ error: "Last message must be from the user." });
    }

    const doc = await StudyPackage.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const reply = await chatAboutLecture(doc, clean);
    res.json({ reply });
  } catch (err) {
    console.error("Chat failed:", err);
    res.status(500).json({ error: "Chat failed. Try again." });
  }
});

export default router;
