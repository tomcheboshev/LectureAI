import { Router } from "express";
import StudyPackage from "../models/StudyPackage.js";
// Промена: Го менуваме импортот да покажува кон новата gemini.js услуга
import { generateStudyPackage } from "../services/gemini.js";

const router = Router();

// POST /api/packages/generate  { video_title, subject, difficulty, transcript }
router.post("/generate", async (req, res) => {
  try {
    const { video_title, subject, difficulty, transcript } = req.body;
    if (!transcript || transcript.trim().length < 50) {
      return res.status(400).json({ error: "Transcript is required (min 50 characters)." });
    }
    if (transcript.length > 400000) {
      return res.status(400).json({ error: "Transcript is too long (max 400k characters)." });
    }

    const pkg = await generateStudyPackage({ video_title, subject, difficulty, transcript });
    const doc = await StudyPackage.create({ ...pkg, raw_transcript: transcript });
    res.status(201).json(doc);
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({ error: "Generation failed. Check the server logs and try again." });
  }
});

// GET /api/packages  — light list for the home page
router.get("/", async (_req, res) => {
  const docs = await StudyPackage.find({}, {
    metadata: 1,
    createdAt: 1,
    "quiz.question": 1,
    "flashcards.front": 1,
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    docs.map((d) => ({
      _id: d._id,
      metadata: d.metadata,
      createdAt: d.createdAt,
      quizCount: d.quiz?.length || 0,
      flashcardCount: d.flashcards?.length || 0,
    }))
  );
});

// GET /api/packages/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

// DELETE /api/packages/:id
router.delete("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

export default router;
