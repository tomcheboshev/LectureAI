import { Router } from "express";
import multer from "multer";
import StudyPackage from "../models/StudyPackage.js";
// Промена: Го менуваме импортот да покажува кон новата gemini.js услуга
import { generateStudyPackage, generateStudyPackageFromSources, extractImageText, regenerateSection, explainConcept } from "../services/gemini.js";
import { REGENERATABLE_SECTIONS, EXPLAIN_ACTIONS } from "../prompt.js";
import {
  extractYoutubeVideoId,
  fetchYoutubeMetadata,
  fetchYoutubeTranscript,
  extractPdfText,
  extractDocxText,
  extractPptxText,
  extractSubtitleText,
} from "../services/extract.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const MAX_FILES = 10;
const IMAGE_MIMETYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

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

function fileExt(originalname) {
  return (originalname.split(".").pop() || "").toLowerCase();
}

// Extracts text from one uploaded file based on its extension/mimetype.
// Returns { text, file_type }.
async function extractFileText(file) {
  const ext = fileExt(file.originalname);

  if (ext === "pdf" || file.mimetype === "application/pdf") {
    return { text: await extractPdfText(file.buffer), file_type: "pdf" };
  }
  if (ext === "docx" || file.mimetype.includes("wordprocessingml.document")) {
    return { text: await extractDocxText(file.buffer), file_type: "docx" };
  }
  if (ext === "pptx" || file.mimetype.includes("presentationml.presentation")) {
    return { text: await extractPptxText(file.buffer), file_type: "pptx" };
  }
  if (ext === "srt" || ext === "vtt") {
    return { text: extractSubtitleText(file.buffer), file_type: ext };
  }
  if (ext === "txt" || file.mimetype === "text/plain") {
    return { text: file.buffer.toString("utf-8"), file_type: "txt" };
  }
  if (ext === "md" || file.mimetype === "text/markdown") {
    return { text: file.buffer.toString("utf-8"), file_type: "md" };
  }
  if (IMAGE_MIMETYPES[ext]) {
    return { text: await extractImageText(file.buffer, IMAGE_MIMETYPES[ext]), file_type: "image" };
  }

  const e = new Error(`"${file.originalname}" has an unsupported file type. Supported: PDF, PPTX, DOCX, TXT, MD, SRT, VTT, PNG, JPG.`);
  e.status = 400;
  throw e;
}

// POST /api/packages/from-files  multipart: files[] (1-10), video_title?, subject?, difficulty?
router.post("/from-files", upload.array("files", MAX_FILES), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "At least one file is required." });
    if (files.length > MAX_FILES) return res.status(400).json({ error: `You can upload at most ${MAX_FILES} files at once.` });

    const { video_title, subject, difficulty } = req.body;
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    const extracted = await Promise.all(
      files.map(async (file, order) => {
        const { text, file_type } = await extractFileText(file);
        return { filename: file.originalname, file_type, order, extracted_text: text };
      })
    );

    for (const s of extracted) {
      if (!s.extracted_text || s.extracted_text.trim().length < 20) {
        return res.status(400).json({ error: `Could not extract meaningful text from "${s.filename}".` });
      }
    }

    const combinedText = extracted.map((s) => `=== SOURCE ${s.order}: ${s.filename} ===\n${s.extracted_text}`).join("\n\n");
    const transcriptError = validateTranscript(combinedText);
    if (transcriptError) return res.status(400).json({ error: transcriptError });

    const pkg =
      extracted.length === 1
        ? await generateStudyPackage({ video_title, subject, difficulty, transcript: extracted[0].extracted_text })
        : await generateStudyPackageFromSources({ video_title, subject, difficulty, sources: extracted });

    const sourceType = extracted.length === 1 ? extracted[0].file_type : "mixed";
    const doc = await StudyPackage.create({
      ...pkg,
      raw_transcript: combinedText,
      source: { type: sourceType, filename: extracted.length === 1 ? extracted[0].filename : undefined },
      sources: extracted,
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error("Multi-file generation failed:", err);
    res.status(err.status || 500).json({ error: err.message || "Could not process these files." });
  }
});

// GET /api/packages  — light list for the home page
router.get("/", async (_req, res) => {
  const docs = await StudyPackage.find({}, {
    metadata: 1,
    createdAt: 1,
    source: 1,
    "sources.filename": 1,
    "sources.file_type": 1,
    "sources.order": 1,
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
      sources: d.sources,
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
