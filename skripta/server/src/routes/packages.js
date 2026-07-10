import { Router } from "express";
import multer from "multer";
import StudyPackage from "../models/StudyPackage.js";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { PLAN_LIMITS, planLimits, upgradeError } from "../services/subscription.js";
import { enqueue } from "../services/jobQueue.js";
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
import QuizAttempt from "../models/QuizAttempt.js";
import FlashcardReview from "../models/FlashcardReview.js";
import { recordActivity } from "../services/analytics/activity.js";

const router = Router();
router.use(requireAuth);

// Multer's own cap must cover the highest plan tier (enterprise) — the
// actual per-plan limit is enforced in the route body below, where we can
// give a plan-aware upgrade message instead of multer's generic one. Files
// are buffered in memory (no object storage is wired up), so this is also
// the practical ceiling on how much a single request can hold in RAM.
const HARD_FILE_COUNT_CAP = 50;
const HARD_FILE_SIZE_CAP_MB = 250;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: HARD_FILE_SIZE_CAP_MB * 1024 * 1024 } });
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

async function assertPackageLimit(ownerId, plan) {
  const limits = planLimits(plan);
  if (limits.maxPackages === Infinity) return;
  // Failed generations don't count against the quota — a package that never
  // produced usable content shouldn't permanently occupy one of the user's
  // limited slots.
  const count = await StudyPackage.countDocuments({ owner: ownerId, status: { $ne: "failed" } });
  if (count >= limits.maxPackages) {
    throw upgradeError(
      "package_limit",
      `You've reached the ${limits.maxPackages}-package limit on the ${plan} plan. Upgrade to Pro for unlimited study packages.`,
      { limit: limits.maxPackages, plan }
    );
  }
}

function fileExt(originalname) {
  return (originalname.split(".").pop() || "").toLowerCase();
}

// Extracts text from one uploaded file based on its extension/mimetype.
async function extractFileText(file, ctx) {
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
    return { text: await extractImageText(file.buffer, IMAGE_MIMETYPES[ext], ctx), file_type: "image" };
  }

  const e = new Error(`"${file.originalname}" has an unsupported file type. Supported: PDF, PPTX, DOCX, TXT, MD, SRT, VTT, PNG, JPG.`);
  e.status = 400;
  e.userFacing = true;
  throw e;
}

function userFacingMessage(err, fallback) {
  return err?.userFacing ? err.message : fallback;
}

// --- Background generation jobs ------------------------------------------

async function runTranscriptGeneration(id, ownerId, { video_title, subject, difficulty, transcript }) {
  try {
    await StudyPackage.updateOne({ _id: id }, { status: "generating", progress: 35 });
    const pkg = await generateStudyPackage({ video_title, subject, difficulty, transcript }, { ownerId, packageId: id });
    await StudyPackage.updateOne(
      { _id: id },
      { ...pkg, raw_transcript: transcript, status: "completed", progress: 100, $unset: { generationError: "" } }
    );
    recordActivity(ownerId, "packagesGenerated");
  } catch (err) {
    console.error("Background generation failed:", err);
    await StudyPackage.updateOne(
      { _id: id },
      { status: "failed", progress: 0, generationError: userFacingMessage(err, "Generation failed. Please try again.") }
    );
  }
}

async function runYoutubeGeneration(id, ownerId, { url, subject, difficulty, video_title }) {
  try {
    await StudyPackage.updateOne({ _id: id }, { status: "extracting", progress: 10 });
    const [metadata, transcriptData] = await Promise.all([fetchYoutubeMetadata(url).catch(() => ({})), fetchYoutubeTranscript(url)]);

    const transcriptError = validateTranscript(transcriptData.text);
    if (transcriptError) throw Object.assign(new Error(transcriptError), { userFacing: true });

    const resolvedTitle = video_title || metadata.title || "Untitled Lecture";
    await StudyPackage.updateOne(
      { _id: id },
      {
        status: "generating",
        progress: 35,
        "metadata.video_title": resolvedTitle,
        "source.thumbnail": metadata.thumbnail,
        "source.channel": metadata.channel,
        "source.duration_seconds": transcriptData.durationSeconds,
      }
    );

    const pkg = await generateStudyPackage(
      { video_title: resolvedTitle, subject, difficulty, transcript: transcriptData.text },
      { ownerId, packageId: id }
    );
    await StudyPackage.updateOne(
      { _id: id },
      { ...pkg, raw_transcript: transcriptData.text, status: "completed", progress: 100, $unset: { generationError: "" } }
    );
    recordActivity(ownerId, "packagesGenerated");
  } catch (err) {
    console.error("Background YouTube generation failed:", err);
    await StudyPackage.updateOne(
      { _id: id },
      { status: "failed", progress: 0, generationError: userFacingMessage(err, "Could not process this YouTube video.") }
    );
  }
}

async function runFilesGeneration(id, ownerId, { files, video_title, subject, difficulty }) {
  try {
    await StudyPackage.updateOne({ _id: id }, { status: "extracting", progress: 10 });

    // Extracted one at a time rather than in parallel — image files call
    // Gemini for OCR/description, and firing several of those concurrently
    // is a fast way to blow through the API key's per-minute rate limit on
    // its own, before generation even starts.
    const extracted = [];
    for (let order = 0; order < files.length; order++) {
      const { text, file_type } = await extractFileText(files[order], { ownerId, packageId: id });
      extracted.push({ filename: files[order].originalname, file_type, order, extracted_text: text });
    }

    for (const s of extracted) {
      if (!s.extracted_text || s.extracted_text.trim().length < 20) {
        throw Object.assign(new Error(`Could not extract meaningful text from "${s.filename}".`), { userFacing: true });
      }
    }

    const combinedText = extracted.map((s) => `=== SOURCE ${s.order}: ${s.filename} ===\n${s.extracted_text}`).join("\n\n");
    const transcriptError = validateTranscript(combinedText);
    if (transcriptError) throw Object.assign(new Error(transcriptError), { userFacing: true });

    const sourceType = extracted.length === 1 ? extracted[0].file_type : "mixed";
    const titleFromFile = extracted.length === 1 ? extracted[0].filename.replace(/\.[^.]+$/, "") : undefined;
    const resolvedTitle = video_title || titleFromFile;

    await StudyPackage.updateOne(
      { _id: id },
      {
        status: "generating",
        progress: 40,
        sources: extracted,
        "source.type": sourceType,
        "source.filename": extracted.length === 1 ? extracted[0].filename : undefined,
        ...(resolvedTitle ? { "metadata.video_title": resolvedTitle } : {}),
      }
    );

    const pkg =
      extracted.length === 1
        ? await generateStudyPackage(
            { video_title: resolvedTitle, subject, difficulty, transcript: extracted[0].extracted_text },
            { ownerId, packageId: id }
          )
        : await generateStudyPackageFromSources({ video_title, subject, difficulty, sources: extracted }, { ownerId, packageId: id });

    await StudyPackage.updateOne(
      { _id: id },
      { ...pkg, raw_transcript: combinedText, status: "completed", progress: 100, $unset: { generationError: "" } }
    );
    recordActivity(ownerId, "packagesGenerated");
  } catch (err) {
    console.error("Background multi-file generation failed:", err);
    await StudyPackage.updateOne(
      { _id: id },
      { status: "failed", progress: 0, generationError: userFacingMessage(err, "Could not process these files.") }
    );
  }
}

// --- Routes ----------------------------------------------------------------

// POST /api/packages/generate  { video_title, subject, difficulty, transcript }
router.post("/generate", async (req, res) => {
  try {
    const { video_title, subject, difficulty, transcript } = req.body;
    const transcriptError = validateTranscript(transcript);
    if (transcriptError) return res.status(400).json({ error: transcriptError });
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    await assertPackageLimit(req.userId, req.user.plan);

    const doc = await StudyPackage.create({
      owner: req.userId,
      status: "queued",
      progress: 0,
      metadata: { video_title: video_title || "Generating…", subject },
      source: { type: "transcript" },
    });

    enqueue(() => runTranscriptGeneration(doc._id, req.userId, { video_title, subject, difficulty, transcript }), {
      priority: planLimits(req.user.plan).priority,
    });
    res.status(202).json({ _id: doc._id, status: doc.status });
  } catch (err) {
    console.error("Generation failed:", err);
    respondError(res, err, "Generation failed. Check the server logs and try again.");
  }
});

// POST /api/packages/from-youtube  { url, subject, difficulty, video_title? }
router.post("/from-youtube", async (req, res) => {
  try {
    const { url, subject, difficulty, video_title } = req.body;
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) return res.status(400).json({ error: "That doesn't look like a valid YouTube video URL." });
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    await assertPackageLimit(req.userId, req.user.plan);

    const doc = await StudyPackage.create({
      owner: req.userId,
      status: "queued",
      progress: 0,
      metadata: { video_title: video_title || "Generating…", subject },
      source: { type: "youtube", url },
    });

    enqueue(() => runYoutubeGeneration(doc._id, req.userId, { url, subject, difficulty, video_title }), {
      priority: planLimits(req.user.plan).priority,
    });
    res.status(202).json({ _id: doc._id, status: doc.status });
  } catch (err) {
    console.error("YouTube generation failed:", err);
    respondError(res, err, "Could not process this YouTube video.");
  }
});

// POST /api/packages/from-files  multipart: files[] (1-N, plan-limited), video_title?, subject?, difficulty?
router.post("/from-files", upload.array("files", HARD_FILE_COUNT_CAP), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "At least one file is required." });

    const limits = planLimits(req.user.plan);
    if (files.length > limits.maxFilesPerPackage) {
      return respondError(
        res,
        upgradeError(
          "file_count",
          `Your ${req.user.plan} plan allows up to ${limits.maxFilesPerPackage} files per package (Pro allows up to ${PLAN_LIMITS.pro.maxFilesPerPackage}).`,
          { limit: limits.maxFilesPerPackage, plan: req.user.plan }
        ),
        "Too many files for your plan."
      );
    }
    const maxBytes = limits.maxFileSizeMB * 1024 * 1024;
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      return respondError(
        res,
        upgradeError(
          "file_size",
          `"${tooBig.originalname}" exceeds your ${req.user.plan} plan's ${limits.maxFileSizeMB}MB per-file limit (Pro allows up to ${PLAN_LIMITS.pro.maxFileSizeMB}MB).`,
          { limit: limits.maxFileSizeMB, plan: req.user.plan }
        ),
        "File too large for your plan."
      );
    }

    const { video_title, subject, difficulty } = req.body;
    const titleError = validateTitleAndSubject(video_title, subject);
    if (titleError) return res.status(400).json({ error: titleError });

    await assertPackageLimit(req.userId, req.user.plan);

    const doc = await StudyPackage.create({
      owner: req.userId,
      status: "queued",
      progress: 0,
      metadata: { video_title: video_title || files[0].originalname.replace(/\.[^.]+$/, ""), subject },
      source: { type: "mixed" },
    });

    enqueue(() => runFilesGeneration(doc._id, req.userId, { files, video_title, subject, difficulty }), { priority: limits.priority });
    res.status(202).json({ _id: doc._id, status: doc.status });
  } catch (err) {
    console.error("Multi-file generation failed:", err);
    respondError(res, err, "Could not process these files.");
  }
});

// GET /api/packages  — light list for the home page (this user's packages only)
router.get("/", async (req, res) => {
  const docs = await StudyPackage.find(
    { owner: req.userId },
    {
      metadata: 1,
      createdAt: 1,
      source: 1,
      status: 1,
      progress: 1,
      "sources.filename": 1,
      "sources.file_type": 1,
      "sources.order": 1,
      "quiz.question": 1,
      "flashcards.front": 1,
    }
  )
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    docs.map((d) => ({
      _id: d._id,
      metadata: d.metadata,
      createdAt: d.createdAt,
      source: d.source,
      sources: d.sources,
      status: d.status,
      progress: d.progress,
      quizCount: d.quiz?.length || 0,
      flashcardCount: d.flashcards?.length || 0,
    }))
  );
});

// GET /api/packages/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

// PATCH /api/packages/:id  { video_title } — rename
router.patch("/:id", async (req, res) => {
  try {
    const { video_title } = req.body;
    if (!video_title || typeof video_title !== "string" || !video_title.trim() || video_title.length > 300) {
      return res.status(400).json({ error: "video_title is required (max 300 characters)." });
    }
    const doc = await StudyPackage.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { "metadata.video_title": video_title.trim() },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json(doc);
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

// POST /api/packages/:id/duplicate — instant copy of already-generated content
router.post("/:id/duplicate", async (req, res) => {
  try {
    const original = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId })
      .select("+raw_transcript +sources.extracted_text")
      .lean();
    if (!original) return res.status(404).json({ error: "Study package not found." });
    if (original.status !== "completed") {
      return res.status(400).json({ error: "Only a fully generated study package can be duplicated." });
    }

    await assertPackageLimit(req.userId, req.user.plan);

    const { _id, createdAt, updatedAt, chat_history, ...rest } = original;
    const copy = await StudyPackage.create({
      ...rest,
      owner: req.userId,
      chat_history: [],
      metadata: { ...original.metadata, video_title: `${original.metadata?.video_title || "Untitled"} (copy)` },
    });
    res.status(201).json(copy);
  } catch (err) {
    console.error("Duplicate failed:", err);
    respondError(res, err, "Could not duplicate this study package.");
  }
});

// POST /api/packages/:id/regenerate  { section }
router.post("/:id/regenerate", async (req, res) => {
  try {
    const { section } = req.body;
    if (!REGENERATABLE_SECTIONS[section]) {
      return res.status(400).json({ error: `Unknown section "${section}".` });
    }

    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }).select("+raw_transcript");
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    if (doc.status !== "completed") {
      return res.status(409).json({ error: "This study package is still generating." });
    }

    const { key, value } = await regenerateSection(doc, section);
    doc.set(key, value);
    await doc.save();

    res.json({ [key]: value });
  } catch (err) {
    console.error("Regeneration failed:", err);
    respondError(res, err, "Regeneration failed. Check the server logs and try again.");
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

    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }).lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });

    const result = await explainConcept(doc, { term, definition, action, compareWith });
    res.json({ result });
  } catch (err) {
    console.error("Explain failed:", err);
    respondError(res, err, "Explain failed. Check the server logs and try again.");
  }
});

// POST /api/packages/:id/quiz-attempts  { answers: [{ questionIndex, selected, correct }] }
// Records a completed quiz run (QuizPlayer.vue submits once, at the finish
// screen). The client already computed correctness locally for instant
// feedback — there's no secret to protect here — so this recomputes against
// the server's own quiz copy as a data-quality check, not a security gate,
// and doesn't hard-reject a client/server mismatch.
router.post("/:id/quiz-attempts", async (req, res) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: "answers array is required." });
    }

    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }, "quiz status").lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    if (doc.status !== "completed") return res.status(409).json({ error: "This study package is still generating." });

    const quiz = doc.quiz || [];
    const built = answers
      .filter((a) => Number.isInteger(a.questionIndex) && quiz[a.questionIndex])
      .map((a) => {
        const q = quiz[a.questionIndex];
        return {
          questionIndex: a.questionIndex,
          question: q.question,
          concept_tested: q.concept_tested,
          difficulty: q.difficulty,
          selected: a.selected,
          correct: a.selected === q.correctAnswer,
        };
      });
    if (built.length === 0) return res.status(400).json({ error: "No answers matched this package's current quiz." });

    const score = built.filter((a) => a.correct).length;
    const total = built.length;
    const attempt = await QuizAttempt.create({
      owner: req.userId,
      package: req.params.id,
      answers: built,
      score,
      total,
      scorePct: Math.round((score / total) * 100),
    });
    recordActivity(req.userId, "quizAttempts");

    res.status(201).json({ _id: attempt._id, score, total, scorePct: attempt.scorePct });
  } catch (err) {
    console.error("Recording quiz attempt failed:", err);
    respondError(res, err, "Could not record this quiz attempt.");
  }
});

// POST /api/packages/:id/flashcard-reviews  { cardIndex, known }
router.post("/:id/flashcard-reviews", async (req, res) => {
  try {
    const { cardIndex, known } = req.body;
    if (!Number.isInteger(cardIndex) || typeof known !== "boolean") {
      return res.status(400).json({ error: "cardIndex (integer) and known (boolean) are required." });
    }

    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId }, "flashcards status").lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    const card = doc.flashcards?.[cardIndex];
    if (!card) return res.status(400).json({ error: "cardIndex is out of range for this package's current flashcards." });

    const updated = await FlashcardReview.findOneAndUpdate(
      { owner: req.userId, package: req.params.id, cardIndex },
      { $set: { known, front: card.front, lastReviewedAt: new Date() }, $inc: { reviewCount: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    recordActivity(req.userId, "flashcardReviews");

    res.json({ ok: true, reviewCount: updated.reviewCount });
  } catch (err) {
    console.error("Recording flashcard review failed:", err);
    respondError(res, err, "Could not record this flashcard review.");
  }
});

// DELETE /api/packages/:id
router.delete("/:id", async (req, res) => {
  try {
    const doc = await StudyPackage.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid id." });
  }
});

export default router;
