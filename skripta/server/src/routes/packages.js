import { Router } from "express";
import multer from "multer";
import StudyPackage from "../models/StudyPackage.js";
// Промена: Го менуваме импортот да покажува кон новата gemini.js услуга
import { generateStudyPackage, regenerateSection, explainConcept } from "../services/gemini.js";
import { REGENERATABLE_SECTIONS, EXPLAIN_ACTIONS } from "../prompt.js";
import {
  extractYoutubeVideoId,
  fetchYoutubeMetadata,
  fetchYoutubeTranscript,
  extractPdfText,
  extractDocxText,
} from "../services/extract.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function validateTranscript(transcript) {
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 50) {
    return "Transcript is required (min 50 characters).";
  }
  if (transcript.length > 400000) {
    return "Transcript is too long (max 400k characters).";
  }
  return null;
}

function validateTitleAndSubject(video_title, subject) {
  if (video_title !== undefined && (typeof video_title !== "string" || video_title.length > 300)) {
    return "video_title must be a string up to 300 characters.";
  }
  if (subject !== undefined && (typeof subject !== "string" || subject.length > 150)) {
    return "subject must be a string up to 150 characters.";
  }
  return null;
}

async function createPackage({ video_title, subject, difficulty, transcript, source }) {
  const pkg = await generateStudyPackage({ video_title, subject, difficulty, transcript });
  return StudyPackage.create({ ...pkg, raw_transcript: transcript, source });
}

// POST /api/packages/generate  { video_title, subject, difficulty, transcript }
router.post("/generate", async (req, res) => {
  try {
    const { video_title, subject, difficulty, transcript } = req.body;
    const transcriptError = validateTranscript(transcript);
    if (transcriptError) return res.status(400).json({ error: transcriptError });
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    const doc = await createPackage({ video_title, subject, difficulty, transcript, source: { type: "transcript" } });
    res.status(201).json(doc);
  } catch (err) {
    console.error("Generation failed:", err);
    res.status(500).json({ error: "Generation failed. Check the server logs and try again." });
  }
});

// POST /api/packages/from-youtube  { url, subject, difficulty, video_title? }
router.post("/from-youtube", async (req, res) => {
  try {
    const { url, subject, difficulty, video_title } = req.body;
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: "That doesn't look like a valid YouTube video URL." });
    }
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    const [metadata, transcriptData] = await Promise.all([
      fetchYoutubeMetadata(url).catch(() => ({})),
      fetchYoutubeTranscript(url),
    ]);

    const transcriptError = validateTranscript(transcriptData.text);
    if (transcriptError) return res.status(400).json({ error: transcriptError });

    const doc = await createPackage({
      video_title: video_title || metadata.title,
      subject,
      difficulty,
      transcript: transcriptData.text,
      source: {
        type: "youtube",
        url,
        thumbnail: metadata.thumbnail,
        channel: metadata.channel,
        duration_seconds: transcriptData.durationSeconds,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("YouTube generation failed:", err);
    res.status(err.status || 500).json({ error: err.message || "Could not process this YouTube video." });
  }
});

// POST /api/packages/from-file  multipart: file, video_title?, subject?, difficulty?
router.post("/from-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A file is required." });

    const { video_title, subject, difficulty } = req.body;
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();
    let transcript;
    let sourceType;
    if (ext === "pdf" || req.file.mimetype === "application/pdf") {
      transcript = await extractPdfText(req.file.buffer);
      sourceType = "pdf";
    } else if (ext === "docx" || req.file.mimetype.includes("wordprocessingml")) {
      transcript = await extractDocxText(req.file.buffer);
      sourceType = "docx";
    } else if (ext === "txt" || req.file.mimetype === "text/plain") {
      transcript = req.file.buffer.toString("utf-8");
      sourceType = "transcript";
    } else {
      return res.status(400).json({ error: "Only .pdf, .docx and .txt files are supported." });
    }

    const transcriptError = validateTranscript(transcript);
    if (transcriptError) return res.status(400).json({ error: transcriptError });

    const doc = await createPackage({
      video_title: video_title || req.file.originalname.replace(/\.[^.]+$/, ""),
      subject,
      difficulty,
      transcript,
      source: { type: sourceType, filename: req.file.originalname },
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("File generation failed:", err);
    res.status(500).json({ error: err.message || "Could not process this file." });
  }
});

// GET /api/packages  — light list for the home page
router.get("/", async (_req, res) => {
  const docs = await StudyPackage.find({}, {
    metadata: 1,
    createdAt: 1,
    source: 1,
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
      source: d.source,
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

// POST /api/packages/:id/regenerate  { section }
router.post("/:id/regenerate", async (req, res) => {
  try {
    const { section } = req.body;
    if (!REGENERATABLE_SECTIONS[section]) {
      return res.status(400).json({ error: `Unknown section "${section}".` });
    }

    const doc = await StudyPackage.findById(req.params.id).select("+raw_transcript");
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const { key, value } = await regenerateSection(doc, section);
    doc.set(key, value);
    await doc.save();

    res.json({ [key]: value });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ error: "Invalid id." });
    console.error("Regeneration failed:", err);
    res.status(500).json({ error: "Regeneration failed. Check the server logs and try again." });
  }
});

// POST /api/packages/:id/explain  { term, definition, action, compareWith? }
router.post("/:id/explain", async (req, res) => {
  try {
    const { term, definition, action, compareWith } = req.body;
    if (!term || typeof term !== "string") {
      return res.status(400).json({ error: "term is required." });
    }
    if (!EXPLAIN_ACTIONS[action]) {
      return res.status(400).json({ error: `Unknown action "${action}".` });
    }

    const doc = await StudyPackage.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const result = await explainConcept(doc, { term, definition, action, compareWith });
    res.json({ result });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ error: "Invalid id." });
    console.error("Explain failed:", err);
    res.status(500).json({ error: "Explain failed. Check the server logs and try again." });
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
