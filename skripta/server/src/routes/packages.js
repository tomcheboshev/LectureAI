import { Router } from "express";
import multer from "multer";
import StudyPackage from "../models/StudyPackage.js";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { PLAN_LIMITS, planLimits, upgradeError } from "../services/subscription.js";
import { enqueue } from "../services/jobQueue.js";
import {
  generateStudyPackage,
  generateStudyPackageChunked,
  extractImageText,
  regenerateSection,
  explainConcept,
} from "../services/gemini.js";
import { REGENERATABLE_SECTIONS, EXPLAIN_ACTIONS } from "../prompt.js";
import {
  extractYoutubeVideoId,
  fetchYoutubeMetadata,
  fetchYoutubeTranscript,
  extractPdfText,
  extractDocxText,
  extractPptxText,
  extractDocxImages,
  extractPptxImages,
  extractPdfImages,
  extractSubtitleText,
} from "../services/extract.js";
import QuizAttempt from "../models/QuizAttempt.js";
import FlashcardReview from "../models/FlashcardReview.js";
import { recordActivity } from "../services/analytics/activity.js";
import { withTimeout } from "../utils/withTimeout.js";
import { logError } from "../utils/logger.js";

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

// Extracts text and embedded images from one uploaded file based on its
// extension/mimetype.
async function extractFileText(file, ctx) {
  const ext = fileExt(file.originalname);

  if (ext === "pdf" || file.mimetype === "application/pdf") {
    const [text, images] = await Promise.all([extractPdfText(file.buffer), extractPdfImages(file.buffer)]);
    return { text, file_type: "pdf", images };
  }
  if (ext === "docx" || file.mimetype.includes("wordprocessingml.document")) {
    const [text, images] = await Promise.all([extractDocxText(file.buffer), extractDocxImages(file.buffer)]);
    return { text, file_type: "docx", images };
  }
  if (ext === "pptx" || file.mimetype.includes("presentationml.presentation")) {
    const [text, images] = await Promise.all([extractPptxText(file.buffer), extractPptxImages(file.buffer)]);
    return { text, file_type: "pptx", images };
  }
  if (ext === "srt" || ext === "vtt") {
    return { text: extractSubtitleText(file.buffer), file_type: ext, images: [] };
  }
  if (ext === "txt" || file.mimetype === "text/plain") {
    return { text: file.buffer.toString("utf-8"), file_type: "txt", images: [] };
  }
  if (ext === "md" || file.mimetype === "text/markdown") {
    return { text: file.buffer.toString("utf-8"), file_type: "md", images: [] };
  }
  if (IMAGE_MIMETYPES[ext]) {
    return { text: await extractImageText(file.buffer, IMAGE_MIMETYPES[ext], ctx), file_type: "image", images: [] };
  }

  const e = new Error(`"${file.originalname}" has an unsupported file type. Supported: PDF, PPTX, DOCX, TXT, MD, SRT, VTT, PNG, JPG.`);
  e.status = 400;
  e.userFacing = true;
  throw e;
}

// Caps the total number of images sent to Gemini as inline multimodal data
// across an entire (possibly multi-file) upload — bounds request payload
// size and per-generation image-token cost even if several image-heavy
// decks are uploaded together.
const MAX_TOTAL_IMAGES = 30;

// Assigns global "IMG<n>" ids across every source's extracted images (in
// source order), producing the manifest shape gemini.js/prompt.js expect:
// {id, mimeType, base64, sourceIndex, label} for the AI call, kept
// alongside the original buffer so a referenced image can be persisted
// as a data URI after generation without re-deriving it.
function buildImageManifest(extractedSources) {
  const manifest = [];
  outer: for (const source of extractedSources) {
    for (const img of source.images || []) {
      if (manifest.length >= MAX_TOTAL_IMAGES) break outer;
      manifest.push({
        id: `IMG${manifest.length}`,
        mimeType: img.mimeType,
        base64: img.buffer.toString("base64"),
        sourceIndex: source.order,
        label: img.label,
      });
    }
  }
  return manifest;
}

// After generation, the model only echoed back {id, caption, explanation}
// for each referenced image (it never sees or repeats raw image bytes) —
// this attaches the actual base64 data URI from the manifest so the
// frontend has something to render, and drops the id (no longer needed
// once the byte data is inlined).
function attachImageData(pkg, manifest) {
  const byId = new Map(manifest.map((img) => [img.id, img]));
  for (const chapter of pkg.summary || []) {
    chapter.images = (chapter.images || [])
      .map((ref) => {
        const source = byId.get(ref.id);
        if (!source) return null;
        return { caption: ref.caption, explanation: ref.explanation, data: `data:${source.mimeType};base64,${source.base64}` };
      })
      .filter(Boolean);
  }
}

function userFacingMessage(err, fallback) {
  return err?.userFacing ? err.message : fallback;
}

// One consistent, greppable prefix for every stage transition in the
// generation pipeline (Upload -> Extract -> Clean -> Build prompt -> Call
// Gemini -> Receive response -> Validate JSON -> Repair JSON -> Save ->
// Update status -> Completed/Failed) — the actual AI-call stages
// (building the prompt, calling Gemini, receiving/validating/repairing its
// response) are logged inside gemini.js itself, since that's where they
// actually happen; this file logs the stages around them.
function logStage(id, message) {
  console.log(`[pipeline:${id}] ${message}`);
}

// Every background job MUST end in "completed" or "failed" — the frontend
// polls indefinitely and has no other way to learn a job is done. If the
// Mongo write that RECORDS the failure itself throws (a transient
// connection blip at exactly the wrong moment), the job would otherwise be
// stuck showing "generating" forever until the next server restart (the
// stranded-job reconciliation in index.js only runs at startup) — retry
// this specific write before giving up, and log loudly if even that fails.
async function markFailed(id, err, fallback) {
  logError(err, { packageId: id, stage: "generation" });
  const update = { status: "failed", progress: 0, generationError: userFacingMessage(err, fallback), $unset: { progressDetail: "" } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await StudyPackage.updateOne({ _id: id }, update);
      logStage(id, `Failed: ${update.generationError}`);
      return;
    } catch (writeErr) {
      console.error(`[pipeline:${id}] Could not write "failed" status (attempt ${attempt}/3):`, writeErr);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  console.error(
    `[pipeline:${id}] Giving up on marking this package as failed after 3 attempts — it will stay stuck on its current status until the next server restart's stranded-job reconciliation.`
  );
}

// --- Background generation jobs ------------------------------------------

async function runTranscriptGeneration(id, ownerId, { video_title, subject, difficulty, transcript }) {
  try {
    logStage(id, `Cleaning: transcript is ${transcript.length} chars, ready to generate`);
    await StudyPackage.updateOne({ _id: id }, { status: "generating", progress: 35 });
    logStage(id, "Updating status: generating");
    const pkg = await generateStudyPackage({ video_title, subject, difficulty, transcript }, { ownerId, packageId: id });
    logStage(id, "Saving to MongoDB...");
    await StudyPackage.updateOne(
      { _id: id },
      { ...pkg, raw_transcript: transcript, status: "completed", progress: 100, $unset: { generationError: "" } }
    );
    recordActivity(ownerId, "packagesGenerated");
    logStage(id, "Completed.");
  } catch (err) {
    console.error("Background generation failed:", err);
    await markFailed(id, err, "Generation failed. Please try again.");
  }
}

async function runYoutubeGeneration(id, ownerId, { url, subject, difficulty, video_title }) {
  try {
    logStage(id, "Extracting: fetching YouTube metadata + transcript...");
    await StudyPackage.updateOne({ _id: id }, { status: "extracting", progress: 10 });
    // Both calls hit YouTube directly via plain fetch(), which — unlike a
    // browser — has no default timeout in Node; a stalled (not failed)
    // connection would otherwise hang this job forever and permanently
    // occupy one of the background queue's only 2 concurrency slots.
    const [metadata, transcriptData] = await withTimeout(
      Promise.all([fetchYoutubeMetadata(url).catch(() => ({})), fetchYoutubeTranscript(url)]),
      45000,
      "fetching YouTube video data"
    );

    const transcriptError = validateTranscript(transcriptData.text);
    if (transcriptError) throw Object.assign(new Error(transcriptError), { userFacing: true });
    logStage(id, `Cleaning: transcript is ${transcriptData.text.length} chars, ready to generate`);

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
    logStage(id, "Updating status: generating");

    const pkg = await generateStudyPackage(
      { video_title: resolvedTitle, subject, difficulty, transcript: transcriptData.text },
      { ownerId, packageId: id }
    );
    logStage(id, "Saving to MongoDB...");
    await StudyPackage.updateOne(
      { _id: id },
      { ...pkg, raw_transcript: transcriptData.text, status: "completed", progress: 100, $unset: { generationError: "" } }
    );
    recordActivity(ownerId, "packagesGenerated");
    logStage(id, "Completed.");
  } catch (err) {
    console.error("Background YouTube generation failed:", err);
    await markFailed(id, err, "Could not process this YouTube video.");
  }
}

// Shared by the initial upload flow and by /retry: once text (and, for
// docx/pptx/pdf, images) are in hand for every source, the rest of
// generation is identical regardless of whether that text was just
// extracted from freshly uploaded files or reloaded from a previously
// failed package's already-saved `sources[].extracted_text`.
//
// A source that produced too little text (a slide that's all images, a
// scanned page OCR couldn't read, ...) is dropped rather than failing the
// whole generation — but only when at least one OTHER source has usable
// content. A single-file upload with no usable text is still a real error;
// there's nothing left to generate from.
async function generateFromExtractedSources(id, ownerId, { extracted, video_title, subject, difficulty }) {
  logStage(id, `Cleaning: checking ${extracted.length} extracted source(s) for usable text...`);
  const usable = extracted.filter((s) => s.extracted_text && s.extracted_text.trim().length >= 20);
  const droppedForContent = extracted.filter((s) => !usable.includes(s));
  if (droppedForContent.length) {
    console.warn(
      `Dropping ${droppedForContent.length} source(s) with insufficient extracted text: ${droppedForContent.map((s) => s.filename).join(", ")}`
    );
    logStage(id, `Cleaning: dropped ${droppedForContent.length}/${extracted.length} source(s) with insufficient text`);
  }
  if (usable.length === 0) {
    const names = extracted.map((s) => s.filename).join(", ");
    throw Object.assign(new Error(`Could not extract meaningful text from ${extracted.length > 1 ? `any of: ${names}` : `"${names}"`}.`), {
      userFacing: true,
    });
  }
  extracted = usable;

  const combinedText = extracted.map((s) => `=== SOURCE ${s.order}: ${s.filename} ===\n${s.extracted_text}`).join("\n\n");
  const transcriptError = validateTranscript(combinedText);
  if (transcriptError) throw Object.assign(new Error(transcriptError), { userFacing: true });

  const sourceType = extracted.length === 1 ? extracted[0].file_type : "mixed";
  const titleFromFile = extracted.length === 1 ? extracted[0].filename.replace(/\.[^.]+$/, "") : undefined;
  const resolvedTitle = video_title || titleFromFile;
  const imageManifest = buildImageManifest(extracted);

  await StudyPackage.updateOne(
    { _id: id },
    {
      status: "generating",
      progress: 40,
      $unset: { progressDetail: "" },
      sources: extracted.map(({ images, ...s }) => s),
      "source.type": sourceType,
      "source.filename": extracted.length === 1 ? extracted[0].filename : undefined,
      ...(resolvedTitle ? { "metadata.video_title": resolvedTitle } : {}),
    }
  );
  logStage(id, "Updating status: generating");

  // A single call asking the AI to read everything and write everything
  // reliably times out once there's enough material — not a fluke, a direct
  // consequence of how much one request is asking it to read and produce.
  // Multiple files always use the chunked pipeline (one small call per
  // file, then a synthesis call over the merged — much more compact —
  // summaries); a single large source uses it too once past a size where
  // the single-call path is at real risk. Small/typical inputs keep the
  // single call, which is simpler and slightly higher quality since the
  // model sees everything at once.
  const CHUNKED_THRESHOLD_CHARS = 40000;
  const useChunked = extracted.length > 1 || combinedText.length > CHUNKED_THRESHOLD_CHARS;

  logStage(id, `Building prompt: ${useChunked ? "chunked" : "single-call"} path for ${extracted.length} source(s), ${combinedText.length} chars total`);

  let pkg;
  if (!useChunked) {
    pkg = await generateStudyPackage(
      { video_title: resolvedTitle, subject, difficulty, transcript: extracted[0].extracted_text },
      { ownerId, packageId: id },
      imageManifest
    );
  } else {
    // Progress climbs from 40% (extraction done) to 85% across the
    // per-source summary calls, then 85-100% covers the final synthesis
    // call + save — reported best-effort (a progress-update failure must
    // never fail the actual generation it's decorating).
    let completedSources = 0;
    const onSourceDone = (source, ok, errorMessage) => {
      completedSources++;
      const progress = 40 + Math.round((completedSources / extracted.length) * 45);
      const detail = ok
        ? `Summarized "${source.filename}" (${completedSources}/${extracted.length})`
        : `Skipped "${source.filename}" — ${errorMessage} (${completedSources}/${extracted.length})`;
      StudyPackage.updateOne({ _id: id }, { progress, progressDetail: detail }).catch((err) =>
        console.error("Progress update failed:", err)
      );
    };
    pkg = await generateStudyPackageChunked(
      { sources: extracted, video_title: resolvedTitle, subject, difficulty },
      { ownerId, packageId: id },
      imageManifest,
      onSourceDone
    );
  }
  attachImageData(pkg, imageManifest);

  logStage(id, "Saving to MongoDB...");
  await StudyPackage.updateOne(
    { _id: id },
    { ...pkg, raw_transcript: combinedText, status: "completed", progress: 100, $unset: { generationError: "", progressDetail: "" } }
  );
  recordActivity(ownerId, "packagesGenerated");
  logStage(id, "Completed.");
}

async function runFilesGeneration(id, ownerId, { files, video_title, subject, difficulty }) {
  try {
    logStage(id, `Uploading: received ${files.length} file(s): ${files.map((f) => f.originalname).join(", ")}`);
    await StudyPackage.updateOne({ _id: id }, { status: "extracting", progress: 10 });
    logStage(id, "Updating status: extracting");

    // Extracted one at a time rather than in parallel — image files call
    // Gemini for OCR/description, and firing several of those concurrently
    // is a fast way to blow through the API key's per-minute rate limit on
    // its own, before generation even starts.
    //
    // Each file gets its own timeout wrapper as a last line of defense: this
    // job holds one of the background queue's only 2 concurrency slots, so
    // any unbounded hang inside a parser (PDF/PPTX/DOCX text or image
    // extraction) — including ones not yet discovered — would otherwise
    // stall generation for every user on the server, not just fail this one
    // upload.
    // A file that throws during extraction (a corrupt/unsupported-content
    // PPTX slide, a malformed PDF page, ...) is skipped rather than failing
    // every other file in the same upload — generateFromExtractedSources
    // below only fails the whole generation if NO file produced anything
    // usable, matching how it already handles a file that extracts too
    // little text.
    const extracted = [];
    const failedFiles = [];
    for (let order = 0; order < files.length; order++) {
      logStage(id, `Extracting: "${files[order].originalname}" (${order + 1}/${files.length})...`);
      try {
        const { text, file_type, images } = await withTimeout(
          extractFileText(files[order], { ownerId, packageId: id }),
          120000,
          `extracting "${files[order].originalname}"`
        );
        extracted.push({ filename: files[order].originalname, file_type, order, extracted_text: text, images });
        logStage(id, `Extracting: "${files[order].originalname}" done — ${text.length} chars, ${images.length} image(s)`);
      } catch (err) {
        console.warn(`Skipping "${files[order].originalname}" — extraction failed:`, err.message);
        logStage(id, `Extracting: "${files[order].originalname}" FAILED — ${err.message}`);
        failedFiles.push({ filename: files[order].originalname, error: userFacingMessage(err, "extraction failed") });
      }
    }

    if (extracted.length === 0) {
      const names = failedFiles.map((f) => `"${f.filename}" (${f.error})`).join(", ");
      throw Object.assign(new Error(`Could not process any of the uploaded files: ${names}`), { userFacing: true });
    }

    await generateFromExtractedSources(id, ownerId, { extracted, video_title, subject, difficulty });
  } catch (err) {
    console.error("Background multi-file generation failed:", err);
    await markFailed(id, err, "Could not process these files.");
  }
}

// Retry path for a failed file-based package: re-uses the text already
// saved to `sources[].extracted_text` during the original attempt (saved
// before the AI call, so it survives a generation-stage failure)
// instead of asking the user to re-upload. Raw image bytes are never
// persisted (no object storage in this app), so a retried package won't
// re-attempt image extraction — an accepted degradation; a fresh upload is
// the only way to get images back.
async function runFilesRetry(id, ownerId, { sources, video_title, subject }) {
  try {
    logStage(id, `Extracting: reusing ${sources.length} previously-saved source(s), no re-upload needed`);
    const extracted = sources.map((s) => ({ filename: s.filename, file_type: s.file_type, order: s.order, extracted_text: s.extracted_text, images: [] }));
    await generateFromExtractedSources(id, ownerId, { extracted, video_title, subject, difficulty: "auto" });
  } catch (err) {
    console.error("Background file-retry generation failed:", err);
    await markFailed(id, err, "Could not process these files.");
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
      meta: { ownerId: req.userId, packageId: doc._id, label: "transcript" },
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
      meta: { ownerId: req.userId, packageId: doc._id, label: "youtube" },
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
    console.log(`[pipeline] Uploading: ${files.length} file(s) received from user ${req.userId} (${files.map((f) => f.originalname).join(", ")})`);
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

    enqueue(() => runFilesGeneration(doc._id, req.userId, { files, video_title, subject, difficulty }), {
      priority: limits.priority,
      meta: { ownerId: req.userId, packageId: doc._id, label: "files" },
    });
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

// POST /api/packages/:id/retry — re-attempt a failed package's generation.
// Unlike /duplicate (which requires a completed package and creates a new
// one), this reuses the SAME document and whatever input its original
// attempt already managed to save before failing:
//  - youtube: source.url is saved at creation time, before generation ever
//    starts, so this is always retryable — the transcript is just re-fetched.
//  - file uploads: sources[].extracted_text is saved once extraction
//    succeeds, before the AI call — retryable if that got far enough
//    (i.e. the original failure was in generation, not extraction itself).
//  - plain transcript paste: the transcript is only ever persisted on a
//    SUCCESSFUL generation (see runTranscriptGeneration), so a failed one
//    has genuinely lost the input — not retryable, by design, not a bug.
router.post("/:id/retry", async (req, res) => {
  try {
    const doc = await StudyPackage.findOne({ _id: req.params.id, owner: req.userId })
      .select("+sources.extracted_text")
      .lean();
    if (!doc) return res.status(404).json({ error: "Study package not found." });
    if (doc.status !== "failed") {
      return res.status(400).json({ error: "Only a failed study package can be retried." });
    }

    const hasStoredSources = Array.isArray(doc.sources) && doc.sources.length > 0 && doc.sources.every((s) => s.extracted_text);

    if (doc.source?.type === "youtube" && doc.source?.url) {
      // "queued" (not "extracting"/"generating") until the job actually
      // starts running — both concurrency slots may currently be busy with
      // other users' jobs, and jumping straight to a later-stage status
      // here would show progress that hasn't happened yet.
      await StudyPackage.updateOne({ _id: doc._id }, { status: "queued", progress: 0, $unset: { generationError: "", progressDetail: "" } });
      enqueue(
        () =>
          runYoutubeGeneration(doc._id, req.userId, {
            url: doc.source.url,
            subject: doc.metadata?.subject,
            difficulty: "auto",
            video_title: doc.metadata?.video_title !== "Generating…" ? doc.metadata?.video_title : undefined,
          }),
        { priority: planLimits(req.user.plan).priority, meta: { ownerId: req.userId, packageId: doc._id, label: "retry-youtube" } }
      );
    } else if (hasStoredSources) {
      await StudyPackage.updateOne({ _id: doc._id }, { status: "queued", progress: 0, $unset: { generationError: "", progressDetail: "" } });
      enqueue(
        () => runFilesRetry(doc._id, req.userId, { sources: doc.sources, video_title: doc.metadata?.video_title, subject: doc.metadata?.subject }),
        { priority: planLimits(req.user.plan).priority, meta: { ownerId: req.userId, packageId: doc._id, label: "retry-files" } }
      );
    } else {
      return res.status(400).json({
        error: "This package's original content wasn't saved, so it can't be automatically retried — please start a new one.",
        retryable: false,
      });
    }

    res.status(202).json({ _id: doc._id, status: "queued" });
  } catch (err) {
    console.error("Retry failed:", err);
    respondError(res, err, "Could not retry this study package.");
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
