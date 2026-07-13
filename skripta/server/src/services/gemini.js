import { GoogleGenAI, Type } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  REGENERATABLE_SECTIONS,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
  buildExplainPrompt,
  buildChatSystemPrompt,
  suggestedCounts,
  buildSummaryChunkSystemPrompt,
  buildSummaryChunkUserMessage,
  buildSynthesisSystemPrompt,
  buildSynthesisUserMessage,
  buildDistilledSummaryText,
} from "../prompt.js";
import { withTimeout } from "../utils/withTimeout.js";
import AiUsage from "../models/AiUsage.js";
import { estimateCostUsd } from "./analytics/pricing.js";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Fire-and-forget usage logging — a logging failure must never fail the
// actual generation/chat call it's attached to.
function logAiUsage(response, { ownerId, packageId, kind }) {
  if (!ownerId) return;
  const usage = response?.usageMetadata || {};
  const promptTokens = usage.promptTokenCount;
  const candidatesTokens = usage.candidatesTokenCount;
  AiUsage.create({
    owner: ownerId,
    package: packageId,
    kind,
    model: MODEL,
    promptTokens,
    candidatesTokens,
    totalTokens: Number.isFinite(promptTokens) && Number.isFinite(candidatesTokens) ? promptTokens + candidatesTokens : undefined,
    estimatedCostUsd: estimateCostUsd({ model: MODEL, promptTokens, candidatesTokens }),
  }).catch((err) => console.error("AI usage log failed:", err));
}

// Per-call-type output ceilings and timeouts. Without an explicit
// maxOutputTokens, a large package (many quiz/flashcard items, full worked
// solutions) has no ceiling and no detection of truncation; without a
// timeout, a single hung Gemini call can occupy one of the job queue's only
// 2 concurrency slots indefinitely. These are generous — background job
// queue calls, not blocking HTTP requests, so a long-running call doesn't
// tie up a client — but still bounded so one runaway request can't starve
// every other user.
const MAX_OUTPUT_TOKENS = { full: 32000, section: 16000, explain: 1536, chat: 2048, image: 2048, chunk: 32000, synthesis: 32000 };
const CALL_TIMEOUT_MS = { full: 300000, section: 180000, explain: 30000, chat: 60000, image: 60000, chunk: 240000, synthesis: 240000 };

function isTruncated(response) {
  return response?.candidates?.[0]?.finishReason === "MAX_TOKENS";
}

// Gemini reports why generation stopped via candidates[0].finishReason.
// "MAX_TOKENS" means the response was cut off mid-stream — left unchecked,
// this surfaces as a generic "did not return valid JSON" error with no
// indication of the actual cause. "SAFETY"/"RECITATION" mean the model
// declined or blocked the response outright — parsing an empty response as
// JSON would otherwise fail with an equally unhelpful message.
function assertNotTruncated(response, label) {
  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    const err = new Error(`The AI's response for ${label} was cut off before it finished. Please try again.`);
    err.truncated = true;
    err.userFacing = true;
    throw err;
  }
  if (finishReason === "SAFETY" || finishReason === "RECITATION") {
    const err = new Error(`The AI declined to generate ${label} for this material (safety/content filter). Try different source material.`);
    err.userFacing = true;
    throw err;
  }
}

function responseText(response) {
  const text = typeof response?.text === "function" ? response.text() : response?.text;
  return text || "";
}

// Best-effort HTTP status extraction — the exact shape of a thrown error
// varies across @google/genai SDK versions (a numeric `.status`/`.code`, or
// only a message like "[503 Service Unavailable] ..."). Falling back to a
// regex keeps retry/friendly-message logic working even if a future SDK
// version changes the primary field; an unrecognized shape safely resolves
// to `undefined`, which is treated as non-retryable (fails fast) rather
// than silently retrying something that will never succeed.
function errorStatus(err) {
  if (Number.isInteger(err?.status)) return err.status;
  if (Number.isInteger(err?.code) && err.code >= 100 && err.code < 600) return err.code;
  const match = /"code"\s*:\s*(\d{3})/.exec(err?.message || "") || /\[(\d{3})[\s\]]/.exec(err?.message || "");
  return match ? Number(match[1]) : undefined;
}

// Gemini rate-limit errors can include a RetryInfo detail with a suggested
// backoff (e.g. "31s") — honor it when present instead of guessing.
function suggestedRetryDelayMs(err) {
  try {
    const detail = (err?.errorDetails || []).find((d) => d?.["@type"]?.includes("RetryInfo"));
    const secs = parseFloat(detail?.retryDelay || "");
    return Number.isFinite(secs) ? secs * 1000 : null;
  } catch {
    return null;
  }
}

// Gemini returns 429 (rate limited / quota exceeded), 500 (internal error),
// or 503 (overloaded/unavailable) for reasons unrelated to our request; 413
// means the request itself was too large for the model regardless of
// retrying. Retrying the first three with backoff clears most of them
// without the user having to resubmit the whole form.
const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const FRIENDLY_MESSAGES = {
  400: "The request sent to the AI model was malformed. This is likely a bug — please report it.",
  401: "The AI service's API key is invalid or missing. Check the server's GEMINI_API_KEY configuration.",
  403: "The AI service's API key doesn't have permission for this model, or billing isn't enabled for this project.",
  404: `The configured Gemini model ("${MODEL}") was not found. Check the server's GEMINI_MODEL configuration.`,
  413: "This request was too large for the AI model to process, even after splitting. Please try a smaller file.",
  429: "The AI model hit a rate limit. Please wait a moment and try again.",
  500: "The AI service is temporarily unavailable. Please try again shortly.",
  503: "The AI model is currently overloaded with requests. Please try again in a minute.",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(fn, { retries = 4, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = errorStatus(err);
      if (!RETRYABLE_STATUSES.has(status) || attempt === retries) break;

      const suggested = suggestedRetryDelayMs(err);
      const delay = Number.isFinite(suggested) ? Math.min(suggested, 60000) : baseDelayMs * 2 ** attempt;
      console.warn(`Gemini request failed (status ${status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
      await sleep(delay);
    }
  }

  const status = errorStatus(lastErr);

  // A daily/monthly quota exhaustion surfaces as the same 429 as an ordinary
  // per-minute rate limit, but "wait a moment and try again" is actively
  // misleading advice for it — the message text is the only thing that
  // distinguishes the two.
  if (status === 429 && /quota/i.test(lastErr?.message || "")) {
    const e = new Error("The AI service has exhausted its usage quota. Please check the Gemini API plan/billing, or try again later.");
    e.status = 429;
    e.userFacing = true;
    throw e;
  }

  const friendly = FRIENDLY_MESSAGES[status];
  if (friendly) {
    const e = new Error(friendly);
    e.status = status;
    e.userFacing = true;
    throw e;
  }
  throw lastErr;
}

// LaTeX (requested in the prompt for formulas/math) is full of single
// backslashes — \delta, \times, \Sigma — which are invalid inside a JSON
// string unless doubled, and the model doesn't always escape them
// correctly. jsonrepair fixes most malformed-JSON issues (raw newlines,
// trailing commas, stray text around the object) but *drops* unrecognized
// escapes like "\S" rather than preserving them — which would silently
// mangle LaTeX commands. So we double any invalid backslash escape
// ourselves first (preserving the backslash), then hand the result to
// jsonrepair for everything else.
// A lookahead-only regex (matched one backslash at a time) can't tell "this
// is the second half of an already-valid \\ pair" from "this is a fresh
// stray backslash" — it re-examines the second backslash of a correctly
// escaped pair as if it were its own dangling backslash and doubles it
// again, turning a correct "\\log" (-> \log) into a corrupted "\\\log"
// (-> \\log, a literal double backslash that breaks LaTeX rendering).
// Matching each *complete* valid escape sequence as one atomic unit first
// (so the regex engine's match cursor jumps past both characters instead of
// re-visiting the second one) fixes that, while a lone invalid backslash —
// the actual case this function exists for — still falls through to the
// second alternative and gets doubled.
function fixInvalidJsonEscapes(text) {
  return text.replace(/\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (match) => (match.length > 1 ? match : "\\\\"));
}

// Even with responseMimeType/responseSchema constraining Gemini's output,
// keep this extraction pass as a safety net — a truncated response can
// still arrive wrapped in a fence or with a stray trailing character.
// Tracks string/escape state so a "{" or "}" inside a quoted string value
// doesn't miscount brace depth.
function extractJsonSubstring(text) {
  // Anchored to the START and END of the whole response — NOT a bare
  // /```.../ search. The prompt asks the model to embed literal
  // ```mermaid ... ``` fenced code blocks as *string content* inside
  // "diagrams_or_tables_explained", and an unanchored regex matches that
  // first embedded fence pair instead of an actual outer wrapper, extracting
  // a few words from inside a string value as "the JSON" and discarding the
  // entire real response. Only strip a fence when it wraps the whole thing.
  const fenceMatch = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(text);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return candidate.trim();

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  // Unbalanced — most likely a truncated response. Return everything from
  // the opening brace onward and let jsonrepair's own balancing close it.
  return candidate.slice(start);
}

function extractJson(text) {
  console.log(`[pipeline] JSON validation: parsing ${text?.length || 0} char response...`);
  if (!text) throw new Error("Gemini returned an empty response.");

  const jsonSubstring = extractJsonSubstring(text.trim());
  const cleaned = fixInvalidJsonEscapes(jsonSubstring);

  // Try the plain, un-repaired text first — jsonrepair is a safety net for
  // genuinely malformed JSON, not something that should run unconditionally
  // on every response; logging only when it was actually needed makes the
  // "JSON repaired" log line mean something instead of firing every time.
  try {
    const parsed = JSON.parse(cleaned);
    console.log("[pipeline] JSON validation: valid on first parse, no repair needed.");
    return parsed;
  } catch {
    // Fall through to jsonrepair below.
  }

  try {
    const repaired = jsonrepair(cleaned);
    const parsed = JSON.parse(repaired);
    console.log(`[pipeline] JSON repaired: jsonrepair fixed ${repaired.length !== cleaned.length ? "structural issues" : "formatting issues"} in the response.`);
    return parsed;
  } catch (err) {
    console.error(
      `[pipeline] JSON validation FAILED: ${err.message}\n--- RAW GEMINI RESPONSE (${text.length} chars) ---\n${text}\n--- END RAW RESPONSE ---`
    );
    throw new Error(`Gemini did not return valid JSON: ${err.message}`);
  }
}

// Content counts (quiz, flashcards, ...) scale with material size, so we
// can't check for one exact number. Instead check each array is present and
// within a generous range around the target we asked for — this still
// catches a genuinely broken response (empty array, wildly off) without
// failing the whole generation over the model producing 7 questions instead
// of the suggested 6.
function withinRange(actual, target) {
  const min = Math.max(2, Math.round(target * 0.5));
  const max = Math.round(target * 1.6) + 3;
  return actual >= min && actual <= max;
}

const SCALED_SECTIONS = {
  quiz: "quiz",
  flashcards: "flashcards",
  practice_tasks: "practice",
  true_false_questions: "trueFalse",
  short_answer_questions: "shortAnswer",
};

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Repairs/prunes an array of items in place rather than failing the whole
// generation over one malformed entry — a single bad quiz question shouldn't
// discard an otherwise-good 20-question set. Returns { items, warnings }.
function repairItems(arr, { fieldsRequired = [], repair } = {}) {
  const warnings = [];
  const items = [];
  for (const [i, item] of (arr || []).entries()) {
    const repaired = repair ? repair(item, warnings, i) : item;
    if (!repaired) {
      warnings.push(`Item ${i} dropped: failed validation.`);
      continue;
    }
    const missing = fieldsRequired.filter((f) => !isNonEmptyString(repaired[f]));
    if (missing.length) {
      warnings.push(`Item ${i} dropped: missing/empty field(s) ${missing.join(", ")}.`);
      continue;
    }
    items.push(repaired);
  }
  return { items, warnings };
}

// A quiz item is useless to the frontend (QuizPlayer.vue compares
// `selected === correctAnswer`) unless correctAnswer matches one of the
// options verbatim. The model sometimes paraphrases it slightly — repair
// via a case/whitespace-insensitive match before giving up on the item.
function repairQuizItem(item, warnings, i) {
  if (!Array.isArray(item?.options) || item.options.length < 2 || !isNonEmptyString(item.question)) return null;
  if (item.options.includes(item.correctAnswer)) return item;

  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const match = item.options.find((o) => norm(o) === norm(item.correctAnswer));
  if (match) {
    warnings.push(`Quiz item ${i}: correctAnswer repaired to match option text exactly.`);
    return { ...item, correctAnswer: match };
  }
  warnings.push(`Quiz item ${i}: correctAnswer "${item.correctAnswer}" matches no option — dropped.`);
  return null;
}

function repairTrueFalseItem(item) {
  if (!isNonEmptyString(item?.statement)) return null;
  const answer = typeof item.answer === "boolean" ? item.answer : String(item.answer).trim().toLowerCase() === "true";
  return { ...item, answer };
}

function validateGlossary(pkg, warnings) {
  const { items } = repairItems(pkg.glossary, { fieldsRequired: ["term", "meaning"] });
  if (items.length === 0 && (pkg.glossary || []).length > 0) {
    warnings.push("glossary: all items were malformed and dropped.");
  }
  pkg.glossary = items;
}

// The model can only legitimately reference an image id we actually sent it
// (it has no other way to know what "IMG3" is) — anything else is either a
// hallucinated id or a stale one from a differently-shaped request, and
// letting it through would mean the frontend renders a broken/missing image.
function sanitizeChapterImages(images, validIds, warnings) {
  if (!Array.isArray(images) || images.length === 0) return [];
  const kept = images.filter(
    (img) => isNonEmptyString(img?.id) && validIds.has(img.id) && isNonEmptyString(img?.caption) && isNonEmptyString(img?.explanation)
  );
  if (kept.length !== images.length) warnings.push(`summary chapter images: ${images.length - kept.length} invalid/hallucinated reference(s) dropped.`);
  return kept;
}

// Sections beyond the 5 count-scaled ones (quiz/flashcards/etc.) still need
// validation — an omitted or malformed summary/core_concepts/chatbot_context
// would otherwise still be marked "completed". These checks default
// soft-missing/malformed sections to safe empty values rather than failing
// generation outright, since none of them are as user-blocking as a broken
// quiz/flashcard.
function validateAuxiliarySections(pkg, warnings, validIds) {
  if (!pkg.study_scaffolding || typeof pkg.study_scaffolding !== "object") {
    warnings.push("study_scaffolding missing or malformed — defaulted.");
    pkg.study_scaffolding = { mental_model_anchor: "", cognitive_roadmap: [], retention_strategy: "" };
  }

  if (!Array.isArray(pkg.summary)) {
    warnings.push("summary missing or malformed — defaulted to empty array.");
    pkg.summary = [];
  } else {
    pkg.summary = pkg.summary
      .filter((c) => isNonEmptyString(c?.topic_title) && isNonEmptyString(c?.description))
      .map((c) => ({ ...c, images: sanitizeChapterImages(c.images, validIds, warnings) }));
  }

  if (!Array.isArray(pkg.core_concepts)) {
    warnings.push("core_concepts missing or malformed — defaulted to empty array.");
    pkg.core_concepts = [];
  } else {
    pkg.core_concepts = pkg.core_concepts.filter((c) => isNonEmptyString(c?.term) && isNonEmptyString(c?.definition));
  }

  if (!pkg.study_notes || typeof pkg.study_notes !== "object") {
    warnings.push("study_notes missing or malformed — defaulted.");
    pkg.study_notes = {};
  }
  for (const field of ["main_ideas", "important_details", "formulas_or_rules", "processes_or_steps", "common_misunderstandings", "exam_focus"]) {
    if (!Array.isArray(pkg.study_notes[field])) pkg.study_notes[field] = [];
  }
  if (!Array.isArray(pkg.study_notes.comparisons)) pkg.study_notes.comparisons = [];

  if (!Array.isArray(pkg.edge_cases_and_limits)) pkg.edge_cases_and_limits = [];
  if (!Array.isArray(pkg.learning_objectives)) pkg.learning_objectives = [];
  if (!Array.isArray(pkg.prerequisites)) pkg.prerequisites = [];
  if (!Array.isArray(pkg.recommended_next_steps)) pkg.recommended_next_steps = [];
  if (!Array.isArray(pkg.transcription_corrections)) pkg.transcription_corrections = [];

  if (!pkg.chatbot_context || typeof pkg.chatbot_context !== "object") {
    warnings.push("chatbot_context missing or malformed — defaulted.");
    pkg.chatbot_context = {};
  }
  for (const field of ["key_takeaways", "important_terms", "rules_formulas_or_methods", "student_confusion_points", "suggested_student_prompts"]) {
    if (!Array.isArray(pkg.chatbot_context[field])) pkg.chatbot_context[field] = [];
  }
  if (!isNonEmptyString(pkg.chatbot_context.lecture_overview)) pkg.chatbot_context.lecture_overview = pkg.full_lecture_summary || "";
}

function validatePackage(pkg, counts, images = []) {
  if (!pkg.metadata?.video_title) {
    throw new Error("Missing metadata.video_title");
  }

  const validIds = new Set(images.map((img) => img.id));
  const warnings = [];

  for (const [field, countKey] of Object.entries(SCALED_SECTIONS)) {
    const arr = pkg[field];
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`"${field}" must be a non-empty array.`);
    }
    if (!withinRange(arr.length, counts[countKey])) {
      throw new Error(`"${field}" has ${arr.length} items — expected roughly ${counts[countKey]} for this amount of material.`);
    }
  }

  const { items: quizItems, warnings: quizWarnings } = repairItems(pkg.quiz, { fieldsRequired: ["question", "explanation"], repair: repairQuizItem });
  if (quizItems.length === 0) throw new Error("quiz had no valid items after repair.");
  pkg.quiz = quizItems;
  warnings.push(...quizWarnings);

  const { items: flashcardItems, warnings: flashcardWarnings } = repairItems(pkg.flashcards, { fieldsRequired: ["front", "back"] });
  if (flashcardItems.length === 0) throw new Error("flashcards had no valid items after repair.");
  pkg.flashcards = flashcardItems;
  warnings.push(...flashcardWarnings);

  const { items: tfItems, warnings: tfWarnings } = repairItems(pkg.true_false_questions, { fieldsRequired: ["statement", "explanation"], repair: repairTrueFalseItem });
  if (tfItems.length === 0) throw new Error("true_false_questions had no valid items after repair.");
  pkg.true_false_questions = tfItems;
  warnings.push(...tfWarnings);

  const { items: saItems, warnings: saWarnings } = repairItems(pkg.short_answer_questions, { fieldsRequired: ["question", "expected_answer"] });
  if (saItems.length === 0) throw new Error("short_answer_questions had no valid items after repair.");
  pkg.short_answer_questions = saItems;
  warnings.push(...saWarnings);

  const { items: practiceItems, warnings: practiceWarnings } = repairItems(pkg.practice_tasks, { fieldsRequired: ["task", "solution"] });
  if (practiceItems.length === 0) throw new Error("practice_tasks had no valid items after repair.");
  pkg.practice_tasks = practiceItems;
  warnings.push(...practiceWarnings);

  validateGlossary(pkg, warnings);
  validateAuxiliarySections(pkg, warnings, validIds);

  if (warnings.length) console.warn("Study package validation warnings:", warnings);

  return pkg;
}

// --- Gemini response schemas ----------------------------------------------
//
// Gemini's responseSchema constrains the model's own sampling to valid JSON
// matching this shape, rather than relying purely on prose instructions plus
// regex/jsonrepair salvage after the fact — the same technique used for
// formula/LaTeX-heavy, multi-thousand-word responses that are otherwise the
// likeliest place for a model to emit subtly broken JSON. Every shape below
// mirrors the REQUIRED JSON STRUCTURE already documented in prompt.js — the
// schema doesn't invent new structure, it just makes what the prompt already
// asks for enforceable at the API level.
const STR = { type: Type.STRING };
const STR_ARR = { type: Type.ARRAY, items: STR };

const FORMULA_SCHEMA = {
  type: Type.OBJECT,
  properties: { name: STR, formula: STR, variables: STR, when_to_use: STR, example: STR },
  required: ["name", "formula", "variables", "when_to_use", "example"],
};

const IMAGE_REF_SCHEMA = {
  type: Type.OBJECT,
  properties: { id: STR, caption: STR, explanation: STR },
  required: ["id", "caption", "explanation"],
};

const CHAPTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    source_index: { type: Type.INTEGER },
    source_title: { type: Type.STRING, nullable: true },
    timestamp: { type: Type.INTEGER },
    topic_title: STR,
    description: STR,
    formulas: { type: Type.ARRAY, items: FORMULA_SCHEMA },
    algorithms_or_processes: STR_ARR,
    diagrams_or_tables_explained: STR_ARR,
    code_explained: STR_ARR,
    examples: STR_ARR,
    key_points: STR_ARR,
    images: { type: Type.ARRAY, items: IMAGE_REF_SCHEMA },
  },
  required: [
    "topic_title",
    "description",
    "formulas",
    "algorithms_or_processes",
    "diagrams_or_tables_explained",
    "code_explained",
    "examples",
    "key_points",
    "images",
  ],
};

const TRANSCRIPTION_CORRECTION_SCHEMA = {
  type: Type.OBJECT,
  properties: { original: STR, corrected: STR },
  required: ["original", "corrected"],
};

const CHUNK_SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.ARRAY, items: CHAPTER_SCHEMA },
    transcription_corrections: { type: Type.ARRAY, items: TRANSCRIPTION_CORRECTION_SCHEMA },
  },
  required: ["summary", "transcription_corrections"],
};

const CORE_CONCEPT_SCHEMA = {
  type: Type.OBJECT,
  properties: { term: STR, definition: STR, why_it_matters: STR, related_concepts: STR_ARR, common_mistakes: STR, example: STR },
  required: ["term", "definition", "why_it_matters", "related_concepts", "common_mistakes", "example"],
};

const QUIZ_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: STR,
    options: STR_ARR,
    correctAnswer: STR,
    explanation: STR,
    difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
    concept_tested: STR,
  },
  required: ["question", "options", "correctAnswer", "explanation", "difficulty", "concept_tested"],
};

const FLASHCARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    front: STR,
    back: STR,
    category: { type: Type.STRING, enum: ["definition", "formula", "comparison", "process", "example", "mistake"] },
    prompt_type: { type: Type.STRING, enum: ["cloze_deletion", "QA", "structural_fill"] },
    retention_hint: STR,
  },
  required: ["front", "back", "category", "prompt_type", "retention_hint"],
};

const PRACTICE_TASK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    task: STR,
    difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
    hint: STR,
    solution: STR,
    concepts_used: STR_ARR,
  },
  required: ["task", "difficulty", "hint", "solution", "concepts_used"],
};

const TRUE_FALSE_SCHEMA = {
  type: Type.OBJECT,
  properties: { statement: STR, answer: { type: Type.BOOLEAN }, explanation: STR },
  required: ["statement", "answer", "explanation"],
};

const SHORT_ANSWER_SCHEMA = {
  type: Type.OBJECT,
  properties: { question: STR, expected_answer: STR, grading_hint: STR },
  required: ["question", "expected_answer", "grading_hint"],
};

const GLOSSARY_SCHEMA = {
  type: Type.OBJECT,
  properties: { term: STR, meaning: STR },
  required: ["term", "meaning"],
};

const EDGE_CASE_SCHEMA = {
  type: Type.OBJECT,
  properties: { scenario: STR, behavior: STR, fix_or_mitigation: STR },
  required: ["scenario", "behavior", "fix_or_mitigation"],
};

const COMPARISON_SCHEMA = {
  type: Type.OBJECT,
  properties: { concept_a: STR, concept_b: STR, difference: STR },
  required: ["concept_a", "concept_b", "difference"],
};

const METADATA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    video_title: STR,
    subject: STR,
    estimated_level: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced"] },
    estimated_duration_minutes: { type: Type.INTEGER },
    content_type: { type: Type.STRING, enum: ["lecture", "tutorial", "explanation", "problem_solving", "mixed"] },
    language_detected: STR,
    transcript_quality: { type: Type.STRING, enum: ["high", "medium", "low"] },
    short_description: STR,
  },
  required: [
    "video_title",
    "subject",
    "estimated_level",
    "estimated_duration_minutes",
    "content_type",
    "language_detected",
    "transcript_quality",
    "short_description",
  ],
};

const STUDY_SCAFFOLDING_SCHEMA = {
  type: Type.OBJECT,
  properties: { mental_model_anchor: STR, cognitive_roadmap: STR_ARR, retention_strategy: STR },
  required: ["mental_model_anchor", "cognitive_roadmap", "retention_strategy"],
};

const STUDY_NOTES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    main_ideas: STR_ARR,
    important_details: STR_ARR,
    formulas_or_rules: STR_ARR,
    processes_or_steps: STR_ARR,
    comparisons: { type: Type.ARRAY, items: COMPARISON_SCHEMA },
    common_misunderstandings: STR_ARR,
    exam_focus: STR_ARR,
  },
  required: ["main_ideas", "important_details", "formulas_or_rules", "processes_or_steps", "comparisons", "common_misunderstandings", "exam_focus"],
};

const CHATBOT_CONTEXT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lecture_overview: STR,
    key_takeaways: STR_ARR,
    important_terms: STR_ARR,
    rules_formulas_or_methods: STR_ARR,
    student_confusion_points: STR_ARR,
    suggested_student_prompts: STR_ARR,
  },
  required: ["lecture_overview", "key_takeaways", "important_terms", "rules_formulas_or_methods", "student_confusion_points", "suggested_student_prompts"],
};

const SYNTHESIS_PROPERTIES = {
  metadata: METADATA_SCHEMA,
  study_scaffolding: STUDY_SCAFFOLDING_SCHEMA,
  edge_cases_and_limits: { type: Type.ARRAY, items: EDGE_CASE_SCHEMA },
  full_lecture_summary: STR,
  core_concepts: { type: Type.ARRAY, items: CORE_CONCEPT_SCHEMA },
  study_notes: STUDY_NOTES_SCHEMA,
  quiz: { type: Type.ARRAY, items: QUIZ_ITEM_SCHEMA },
  flashcards: { type: Type.ARRAY, items: FLASHCARD_SCHEMA },
  practice_tasks: { type: Type.ARRAY, items: PRACTICE_TASK_SCHEMA },
  true_false_questions: { type: Type.ARRAY, items: TRUE_FALSE_SCHEMA },
  short_answer_questions: { type: Type.ARRAY, items: SHORT_ANSWER_SCHEMA },
  glossary: { type: Type.ARRAY, items: GLOSSARY_SCHEMA },
  learning_objectives: STR_ARR,
  prerequisites: STR_ARR,
  recommended_next_steps: STR_ARR,
  chatbot_context: CHATBOT_CONTEXT_SCHEMA,
};
const SYNTHESIS_REQUIRED = Object.keys(SYNTHESIS_PROPERTIES);

const SYNTHESIS_SCHEMA = { type: Type.OBJECT, properties: SYNTHESIS_PROPERTIES, required: SYNTHESIS_REQUIRED };

const FULL_PACKAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ...SYNTHESIS_PROPERTIES,
    summary: { type: Type.ARRAY, items: CHAPTER_SCHEMA },
    transcription_corrections: { type: Type.ARRAY, items: TRANSCRIPTION_CORRECTION_SCHEMA },
  },
  required: [...SYNTHESIS_REQUIRED, "summary", "transcription_corrections"],
};

// One schema per regeneratable section, keyed the same way as
// REGENERATABLE_SECTIONS in prompt.js — each wraps the section's array/object
// shape under its own top-level key, matching what buildRegenerateSystemPrompt
// asks the model to return.
const REGEN_SCHEMAS = {
  summary: { type: Type.OBJECT, properties: { summary: { type: Type.ARRAY, items: CHAPTER_SCHEMA } }, required: ["summary"] },
  core_concepts: { type: Type.OBJECT, properties: { core_concepts: { type: Type.ARRAY, items: CORE_CONCEPT_SCHEMA } }, required: ["core_concepts"] },
  study_notes: { type: Type.OBJECT, properties: { study_notes: STUDY_NOTES_SCHEMA }, required: ["study_notes"] },
  quiz: { type: Type.OBJECT, properties: { quiz: { type: Type.ARRAY, items: QUIZ_ITEM_SCHEMA } }, required: ["quiz"] },
  flashcards: { type: Type.OBJECT, properties: { flashcards: { type: Type.ARRAY, items: FLASHCARD_SCHEMA } }, required: ["flashcards"] },
  practice_tasks: { type: Type.OBJECT, properties: { practice_tasks: { type: Type.ARRAY, items: PRACTICE_TASK_SCHEMA } }, required: ["practice_tasks"] },
  edge_cases_and_limits: {
    type: Type.OBJECT,
    properties: { edge_cases_and_limits: { type: Type.ARRAY, items: EDGE_CASE_SCHEMA } },
    required: ["edge_cases_and_limits"],
  },
  true_false_questions: {
    type: Type.OBJECT,
    properties: { true_false_questions: { type: Type.ARRAY, items: TRUE_FALSE_SCHEMA } },
    required: ["true_false_questions"],
  },
  short_answer_questions: {
    type: Type.OBJECT,
    properties: { short_answer_questions: { type: Type.ARRAY, items: SHORT_ANSWER_SCHEMA } },
    required: ["short_answer_questions"],
  },
  glossary: { type: Type.OBJECT, properties: { glossary: { type: Type.ARRAY, items: GLOSSARY_SCHEMA } }, required: ["glossary"] },
};

// Builds the multimodal "contents" array for a generation call: the text
// prompt as one part, followed by each extracted image as its own inline
// image part (in manifest order, matching the "IMG<n>" ids the prompt's
// image manifest promised) — Gemini can only ground an "images[].id"
// reference in a chapter if it actually received the corresponding bytes.
function buildContents(promptText, images) {
  const parts = [{ text: promptText }];
  for (const img of images || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }
  return [{ role: "user", parts }];
}

async function generateContent({ system, contents, maxTokens, timeoutMs, label, schema }) {
  console.log(`[pipeline] Building prompt: ${label} (${system ? system.length : 0} system chars, ${JSON.stringify(contents).length} content chars)`);
  console.log(`[pipeline] Calling Gemini: ${label} (model=${MODEL}, maxOutputTokens=${maxTokens})...`);
  const startedAt = Date.now();
  const response = await callGemini(() =>
    withTimeout(
      genAI.models.generateContent({
        model: MODEL,
        contents,
        config: {
          ...(system ? { systemInstruction: system } : {}),
          maxOutputTokens: maxTokens,
          ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
        },
      }),
      timeoutMs,
      label
    )
  );
  const durationMs = Date.now() - startedAt;
  console.log(`[pipeline] Gemini response received: ${label} (${durationMs}ms, finishReason=${response.candidates?.[0]?.finishReason})`);
  return { response, durationMs };
}

export async function generateStudyPackage(input, ctx = {}, images = []) {
  try {
    console.log("Generating study package...");

    const { response, durationMs } = await generateContent({
      system: SYSTEM_PROMPT,
      contents: buildContents(buildUserMessage({ ...input, images }), images),
      maxTokens: MAX_OUTPUT_TOKENS.full,
      timeoutMs: CALL_TIMEOUT_MS.full,
      label: "study package generation",
      schema: FULL_PACKAGE_SCHEMA,
    });
    const text = responseText(response);
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[generate] model=${MODEL} promptChars=${input.transcript.length} responseChars=${text.length} finishReason=${finishReason} durationMs=${durationMs}`);
    assertNotTruncated(response, "the study package");
    logAiUsage(response, { ...ctx, kind: "generate" });

    const pkg = extractJson(text);
    validatePackage(pkg, suggestedCounts(input.transcript.length), images);
    return pkg;
  } catch (err) {
    console.error("Gemini generation error:", err);
    throw err;
  }
}

// --- Chunked generation (large multi-file / large single-source inputs) --
//
// See prompt.js's comment above SUMMARY_CHUNK_SYSTEM_PROMPT for why this
// exists: a single call asking the model to both read everything and write
// everything reliably times out once the input/expected-output grows large
// enough — a provider-agnostic risk, not specific to any one model. This
// splits into small calls (one per source, or several per source once the
// source itself is large — see splitTextIntoChunks below) each producing
// only summary chapters, plus one synthesis call (everything else, working
// from the now-compact merged summary instead of raw transcripts) — every
// individual call's input and output stays bounded regardless of how many
// files or how large the material is.

// Splits `text` into pieces no larger than `maxChars`, breaking at
// paragraph boundaries where possible (never mid-sentence unless a single
// paragraph itself exceeds maxChars, in which case it's hard-split). A
// large single PDF/PPTX source is the exact case that still risks
// truncation under simple one-call-per-file chunking: a dense 100-slide
// deck can need 20-40 chapters on its own, which can exceed even a single
// chunk call's output ceiling. Proactively splitting the SOURCE TEXT before
// ever calling the model — rather than reactively detecting truncation
// after the fact — is what actually fixes that, not a bigger timeout.
export function splitTextIntoChunks(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = p;
    } else {
      current = candidate;
    }
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const CHUNK_MAX_CHARS = 15000;
const MAX_CHUNK_ATTEMPTS = 3;
const MAX_SPLIT_DEPTH = 2;
const MIN_SPLITTABLE_CHARS = 4000;

// Generates summary chapters for one piece of source text, with layered
// resilience against every incomplete-response cause the model can produce:
//  1. Try to parse the response even when finishReason=MAX_TOKENS —
//     jsonrepair frequently recovers a valid partial array by dropping only
//     the incomplete trailing entry, so a "truncated" response often still
//     yields several perfectly good chapters rather than zero.
//  2. If that yields nothing usable, retry the identical request up to
//     MAX_CHUNK_ATTEMPTS times with exponential backoff — covers transient
//     truncation/parse issues that succeed on a fresh attempt.
//  3. If every attempt is exhausted and the chunk is still large enough to
//     split, split it in half and recurse on each half independently — a
//     chunk that's persistently too dense for the model to fully complete
//     in one response very often succeeds once it's smaller.
// Only after all of that fails is the chunk actually given up on.
async function generateChunkChapters(source, chunkText, label, ctx, chunkImages, depth = 0) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const { response, durationMs } = await generateContent({
        system: buildSummaryChunkSystemPrompt(),
        contents: buildContents(
          buildSummaryChunkUserMessage({ video_title: ctx.video_title, subject: ctx.subject, source: { ...source, extracted_text: chunkText }, images: chunkImages }),
          chunkImages
        ),
        maxTokens: MAX_OUTPUT_TOKENS.chunk,
        timeoutMs: CALL_TIMEOUT_MS.chunk,
        label: `summarizing ${label}`,
        schema: CHUNK_SUMMARY_SCHEMA,
      });
      const text = responseText(response);
      const finishReason = response.candidates?.[0]?.finishReason;
      console.log(
        `[chunk] ${label} model=${MODEL} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} depth=${depth} promptChars=${chunkText.length} responseChars=${text.length} finishReason=${finishReason} durationMs=${durationMs}`
      );
      logAiUsage(response, { ...ctx, kind: "generate_chunk" });

      let data;
      try {
        data = extractJson(text);
      } catch (parseErr) {
        throw Object.assign(new Error(`${label}: ${isTruncated(response) ? "truncated and unparseable" : `invalid JSON (${parseErr.message})`}`), {
          truncated: isTruncated(response),
        });
      }

      const chapters = (Array.isArray(data.summary) ? data.summary : [])
        .filter((c) => isNonEmptyString(c?.topic_title) && isNonEmptyString(c?.description))
        .map((c) => ({
          ...c,
          source_index: source.order,
          source_title: source.filename.replace(/\.[^.]+$/, ""),
          images: sanitizeChapterImages(c.images, new Set(chunkImages.map((img) => img.id)), []),
        }));

      if (chapters.length === 0) throw new Error(`${label}: response parsed but contained no usable chapters`);

      if (isTruncated(response)) {
        console.warn(`[chunk] ${label} was truncated but salvaged ${chapters.length} chapter(s) via jsonrepair.`);
      }
      return { chapters, corrections: Array.isArray(data.transcription_corrections) ? data.transcription_corrections : [] };
    } catch (err) {
      lastErr = err;
      console.warn(`[chunk] ${label} attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }

  if (depth < MAX_SPLIT_DEPTH && chunkText.length > MIN_SPLITTABLE_CHARS) {
    console.warn(`[chunk] ${label}: all ${MAX_CHUNK_ATTEMPTS} attempts failed, splitting into two smaller pieces and retrying (depth ${depth + 1})`);
    const mid = Math.floor(chunkText.length / 2);
    const [a, b] = [chunkText.slice(0, mid), chunkText.slice(mid)];
    const [ra, rb] = await Promise.all([
      generateChunkChapters(source, a, `${label}.a`, ctx, chunkImages, depth + 1).catch((e) => {
        console.warn(`[chunk] ${label}.a permanently failed: ${e.message}`);
        return null;
      }),
      generateChunkChapters(source, b, `${label}.b`, ctx, [], depth + 1).catch((e) => {
        console.warn(`[chunk] ${label}.b permanently failed: ${e.message}`);
        return null;
      }),
    ]);
    const chapters = [...(ra?.chapters || []), ...(rb?.chapters || [])];
    const corrections = [...(ra?.corrections || []), ...(rb?.corrections || [])];
    if (chapters.length > 0) return { chapters, corrections };
  }

  throw lastErr;
}

async function generateSynthesisWithRetry({ video_title, subject, difficulty, distilledSummary, counts }, ctx) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const { response, durationMs } = await generateContent({
        system: buildSynthesisSystemPrompt(),
        contents: [{ role: "user", parts: [{ text: buildSynthesisUserMessage({ video_title, subject, difficulty, distilledSummary, counts }) }] }],
        maxTokens: MAX_OUTPUT_TOKENS.synthesis,
        timeoutMs: CALL_TIMEOUT_MS.synthesis,
        label: "study package synthesis",
        schema: SYNTHESIS_SCHEMA,
      });
      const text = responseText(response);
      const finishReason = response.candidates?.[0]?.finishReason;
      console.log(
        `[synthesis] model=${MODEL} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} promptChars=${distilledSummary.length} responseChars=${text.length} finishReason=${finishReason} durationMs=${durationMs}`
      );
      logAiUsage(response, { ...ctx, kind: "generate_synthesis" });

      // Same salvage-first philosophy as generateChunkChapters: jsonrepair
      // can often recover a partial object (e.g. quiz intact, flashcards
      // array truncated) by dropping only the incomplete trailing entry —
      // validatePackage already tolerates missing/malformed sections
      // gracefully, so a partial synthesis result is still worth using
      // rather than discarding outright.
      try {
        return extractJson(text);
      } catch (parseErr) {
        throw Object.assign(new Error(`synthesis: ${isTruncated(response) ? "truncated and unparseable" : `invalid JSON (${parseErr.message})`}`), {
          truncated: isTruncated(response),
        });
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[synthesis] attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

// Runs `worker(item, index)` over `items` with at most `limit` concurrently
// in flight — plain Promise.all would fire every source's summary call at
// once, which for a large multi-file upload is a fast way to blow through
// the API key's per-minute rate limit before any of them finish.
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const CHUNK_CONCURRENCY = 2;

/**
 * Chunked alternative to generateStudyPackage for large inputs. `images` is
 * the full manifest across all sources (each entry tagged with sourceIndex,
 * matching source.order). `onSourceDone(source, ok, detail)` is called once
 * per SOURCE (aggregating across however many sub-chunks that source was
 * split into) as soon as all its sub-chunks have settled, for progress
 * reporting — a source that was large enough to need multiple sub-chunks
 * still reports as one unit to the caller.
 */
export async function generateStudyPackageChunked({ sources, video_title, subject, difficulty }, ctx = {}, images = [], onSourceDone) {
  const totalChars = sources.reduce((sum, s) => sum + (s.extracted_text?.length || 0), 0);
  const counts = suggestedCounts(totalChars);

  // Flatten into (source, sub-chunk) work items — most sources are small
  // enough to produce exactly one item; only a genuinely large single
  // source (a dense 100-slide deck, a long PDF) gets split into several.
  const workItems = sources.flatMap((source) => {
    const pieces = splitTextIntoChunks(source.extracted_text, CHUNK_MAX_CHARS);
    return pieces.map((text, chunkIndex) => ({ source, text, chunkIndex, chunkCount: pieces.length }));
  });
  console.log(
    `[chunked-generation] ${sources.length} source(s) split into ${workItems.length} work item(s): ${workItems
      .map((w) => `${w.source.filename}[${w.chunkIndex + 1}/${w.chunkCount}]`)
      .join(", ")}`
  );

  const results = await runWithConcurrency(workItems, CHUNK_CONCURRENCY, async (item) => {
    const label = item.chunkCount > 1 ? `"${item.source.filename}" (part ${item.chunkIndex + 1}/${item.chunkCount})` : `"${item.source.filename}"`;
    // Images are tied to the whole source, not any one sub-chunk — attach
    // them only to the first piece so they're referenced exactly once.
    const chunkImages = item.chunkIndex === 0 ? images.filter((img) => img.sourceIndex === item.source.order) : [];
    try {
      const r = await generateChunkChapters(item.source, item.text, label, { ...ctx, video_title, subject }, chunkImages);
      return { ok: true, source: item.source, ...r };
    } catch (err) {
      console.warn(`[chunked-generation] Giving up on ${label} — every recovery attempt failed:`, err.message);
      return { ok: false, source: item.source, error: err.message };
    }
  });

  // Report per-source (not per-sub-chunk) once all of a source's pieces
  // have settled, matching the extraction-stage policy (routes/packages.js)
  // of skipping one bad unit rather than failing everything — here that
  // policy applies at sub-chunk granularity: a source that partially
  // succeeded (some pieces failed, others didn't) still contributes
  // whatever chapters its successful pieces produced.
  const bySource = new Map();
  for (const r of results) {
    if (!bySource.has(r.source.order)) bySource.set(r.source.order, { source: r.source, items: [] });
    bySource.get(r.source.order).items.push(r);
  }
  for (const { source, items } of bySource.values()) {
    const anyOk = items.some((r) => r.ok);
    const failedCount = items.filter((r) => !r.ok).length;
    onSourceDone?.(source, anyOk, failedCount > 0 && items.length > 1 ? `${failedCount}/${items.length} part(s) failed` : items[0]?.error);
  }

  const succeeded = results.filter((r) => r.ok);
  if (succeeded.length === 0) {
    throw Object.assign(
      new Error("Could not generate content for any of the uploaded sources after multiple retries. Please try again."),
      { userFacing: true }
    );
  }
  if (succeeded.length < results.length) {
    console.warn(`[chunked-generation] Proceeding with ${succeeded.length}/${results.length} work item(s); the rest failed after every recovery attempt.`);
  }

  const allChapters = succeeded.flatMap((r) => r.chapters);
  const allCorrections = succeeded.flatMap((r) => r.corrections);
  const distilledSummary = buildDistilledSummaryText(allChapters);

  let synthesis;
  try {
    synthesis = await generateSynthesisWithRetry({ video_title, subject, difficulty, distilledSummary, counts }, ctx);
  } catch (err) {
    // The per-source/per-chunk summary work above already succeeded and
    // represents real, potentially expensive AI calls — losing that
    // silently on top of a synthesis failure would compound one failure
    // into a bigger one. This can't be saved as a usable package on its
    // own (quiz/flashcards/etc. genuinely don't exist yet, and the schema
    // requires them), but the error at minimum says so honestly instead of
    // reporting a bare "generation failed" that erases the fact that
    // ${allChapters.length} chapters of real content were produced.
    console.error(
      `[chunked-generation] Synthesis failed after generating ${allChapters.length} summary chapter(s) across ${succeeded.length}/${results.length} work item(s):`,
      err.message
    );
    throw Object.assign(
      new Error(
        `Generated detailed notes for ${allChapters.length} section(s), but could not complete the quiz/flashcards/study guide: ${err.message}. Please try again.`
      ),
      { userFacing: true }
    );
  }

  const pkg = { ...synthesis, summary: allChapters, transcription_corrections: allCorrections };
  if (!pkg.metadata) pkg.metadata = {};
  if (!isNonEmptyString(pkg.metadata.video_title)) pkg.metadata.video_title = video_title || "Untitled Lecture";

  validatePackage(pkg, counts, images);
  return pkg;
}

export async function extractImageText(buffer, mimeType, ctx = {}) {
  try {
    const { response, durationMs } = await generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Transcribe every piece of text visible in this image (including handwriting), and describe any diagrams, tables, charts or formulas in detail. If this looks like a slide, include its title and all bullet points in order. Plain text output, no markdown.",
            },
            { inlineData: { mimeType, data: buffer.toString("base64") } },
          ],
        },
      ],
      maxTokens: MAX_OUTPUT_TOKENS.image,
      timeoutMs: CALL_TIMEOUT_MS.image,
      label: "image extraction",
    });
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[image_extract] model=${MODEL} finishReason=${finishReason} durationMs=${durationMs}`);
    assertNotTruncated(response, "the image transcription");
    logAiUsage(response, { ...ctx, kind: "image_extract" });
    return responseText(response);
  } catch (err) {
    console.error("Gemini image extraction error:", err);
    throw err;
  }
}

// Per-item repair rules for the array-shaped regeneratable sections — mirrors
// the checks validatePackage applies to a full generation, so a regenerated
// section gets the same auto-repair/drop-bad-item treatment instead of
// failing outright over one malformed entry. Sections not listed here are
// either objects (study_notes) or don't need item-level repair beyond the
// array-shape check already performed below.
const SECTION_ITEM_REPAIR = {
  quiz: { fieldsRequired: ["question", "explanation"], repair: repairQuizItem },
  flashcards: { fieldsRequired: ["front", "back"] },
  true_false_questions: { fieldsRequired: ["statement", "explanation"], repair: repairTrueFalseItem },
  short_answer_questions: { fieldsRequired: ["question", "expected_answer"] },
  practice_tasks: { fieldsRequired: ["task", "solution"] },
  glossary: { fieldsRequired: ["term", "meaning"] },
  core_concepts: { fieldsRequired: ["term", "definition"] },
};

function validateSection(section, data, counts) {
  const key = REGENERATABLE_SECTIONS[section].key;
  let value = data[key];
  if (value === undefined) throw new Error(`Gemini's response is missing "${key}".`);

  const repairConfig = SECTION_ITEM_REPAIR[section];
  if (repairConfig) {
    if (!Array.isArray(value)) throw new Error(`"${key}" must be an array.`);
    const { items, warnings } = repairItems(value, repairConfig);
    if (items.length === 0) throw new Error(`"${key}" had no valid items after repair.`);
    if (warnings.length) console.warn(`Section regeneration (${section}) warnings:`, warnings);
    value = items;
  }

  const countKey = SCALED_SECTIONS[section];
  if (countKey) {
    if (value.length === 0) {
      throw new Error(`"${key}" must be a non-empty array.`);
    }
    if (!withinRange(value.length, counts[countKey])) {
      throw new Error(`"${key}" has ${value.length} items — expected roughly ${counts[countKey]} for this amount of material.`);
    }
  }
  return value;
}

// Regenerating a section gets the same retry-with-backoff + salvage
// treatment as chunk generation — a truncated or malformed response for a
// single section shouldn't force the user to re-request it manually when
// one automatic retry usually clears it.
export async function regenerateSection(pkgDoc, section) {
  if (!REGENERATABLE_SECTIONS[section]) {
    throw new Error(`"${section}" is not a regeneratable section.`);
  }
  if (!pkgDoc.raw_transcript) {
    throw new Error("Original transcript is unavailable for regeneration.");
  }

  const counts = suggestedCounts(pkgDoc.raw_transcript.length);
  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const { response, durationMs } = await generateContent({
        system: buildRegenerateSystemPrompt(section, counts, (pkgDoc.sources?.length || 0) > 1),
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildRegenerateUserMessage({
                  video_title: pkgDoc.metadata?.video_title,
                  subject: pkgDoc.metadata?.subject,
                  transcript: pkgDoc.raw_transcript,
                }),
              },
            ],
          },
        ],
        maxTokens: MAX_OUTPUT_TOKENS.section,
        timeoutMs: CALL_TIMEOUT_MS.section,
        label: `regenerating ${section}`,
        schema: REGEN_SCHEMAS[section],
      });
      const text = responseText(response);
      const finishReason = response.candidates?.[0]?.finishReason;
      console.log(`[regenerate] section=${section} model=${MODEL} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} finishReason=${finishReason} durationMs=${durationMs}`);
      logAiUsage(response, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "regenerate" });

      const data = extractJson(text);
      return { key: REGENERATABLE_SECTIONS[section].key, value: validateSection(section, data, counts) };
    } catch (err) {
      lastErr = err;
      console.warn(`[regenerate] section=${section} attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  console.error(`Gemini regenerate (${section}) error:`, lastErr);
  throw lastErr;
}

export async function explainConcept(pkgDoc, { term, definition, action, compareWith }) {
  try {
    const prompt = buildExplainPrompt({
      lectureTitle: pkgDoc.metadata?.video_title,
      lectureSummary: pkgDoc.full_lecture_summary,
      term,
      definition,
      action,
      compareWith,
    });

    const { response, durationMs } = await generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      maxTokens: MAX_OUTPUT_TOKENS.explain,
      timeoutMs: CALL_TIMEOUT_MS.explain,
      label: "concept explanation",
    });
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[explain] model=${MODEL} finishReason=${finishReason} durationMs=${durationMs}`);
    assertNotTruncated(response, "the explanation");
    logAiUsage(response, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "explain" });

    return responseText(response);
  } catch (err) {
    console.error("Gemini explain error:", err);
    throw err;
  }
}

export async function chatAboutLecture(pkgDoc, messages) {
  try {
    // Gemini's message roles are "user"/"model" — unlike this app's own chat
    // history (which stores "assistant" for the AI turn, matching the
    // frontend's naming), so the assistant role needs translating on the way
    // in. There is no reverse translation needed on the way out — the reply
    // is stored back as "assistant" by the caller, matching the DB shape.
    const geminiContents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const { response, durationMs } = await generateContent({
      system: buildChatSystemPrompt(pkgDoc),
      contents: geminiContents,
      maxTokens: MAX_OUTPUT_TOKENS.chat,
      timeoutMs: CALL_TIMEOUT_MS.chat,
      label: "chat reply",
    });
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[chat] model=${MODEL} finishReason=${finishReason} durationMs=${durationMs}`);
    assertNotTruncated(response, "the chat reply");
    logAiUsage(response, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "chat" });

    return responseText(response);
  } catch (err) {
    console.error("Gemini chat error:", err);
    throw err;
  }
}
