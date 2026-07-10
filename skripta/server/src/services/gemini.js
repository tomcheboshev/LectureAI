import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  MULTI_SOURCE_INSTRUCTIONS,
  buildMultiSourceUserMessage,
  REGENERATABLE_SECTIONS,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
  buildExplainPrompt,
  buildChatSystemPrompt,
  suggestedCounts,
} from "../prompt.js";
import { REGENERATE_RESPONSE_SCHEMAS } from "./schemas.js";
import { withTimeout } from "../utils/withTimeout.js";
import AiUsage from "../models/AiUsage.js";
import { estimateCostUsd } from "./analytics/pricing.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Fire-and-forget usage logging — result.usageMetadata was never read
// anywhere before this, so there was zero AI-cost/token visibility at any
// layer. A logging failure must never fail the actual generation/chat call
// it's attached to.
function logAiUsage(result, { ownerId, packageId, kind }) {
  if (!ownerId) return;
  const usage = result?.usageMetadata || {};
  AiUsage.create({
    owner: ownerId,
    package: packageId,
    kind,
    model: MODEL,
    promptTokens: usage.promptTokenCount,
    candidatesTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
    estimatedCostUsd: estimateCostUsd({
      model: MODEL,
      promptTokens: usage.promptTokenCount,
      candidatesTokens: usage.candidatesTokenCount,
    }),
  }).catch((err) => console.error("AI usage log failed:", err));
}

// Per-call-type output ceilings and timeouts. Without an explicit
// maxOutputTokens, a large package (many quiz/flashcard items, full worked
// solutions) has no ceiling and no detection of truncation; without a
// timeout, a single hung Gemini call can occupy one of the job queue's only
// 2 concurrency slots indefinitely.
const MAX_OUTPUT_TOKENS = { full: 65536, section: 8192, explain: 1536, chat: 2048, image: 4096 };
const CALL_TIMEOUT_MS = { full: 180000, section: 90000, explain: 30000, chat: 60000, image: 60000 };

// The Gemini SDK reports why generation stopped via `finishReason` on the
// first candidate. "MAX_TOKENS" means the response was cut off mid-stream —
// left unchecked, this surfaces as a generic "did not return valid JSON"
// error with no indication of the actual cause.
function assertNotTruncated(result, label) {
  const reason = result.candidates?.[0]?.finishReason;
  if (reason === "MAX_TOKENS") {
    const err = new Error(`The AI's response for ${label} was cut off before it finished. Please try again.`);
    err.truncated = true;
    err.userFacing = true;
    throw err;
  }
}

// Gemini occasionally returns 429 (rate limited) or 500/503 (overloaded) for
// reasons unrelated to our request — retrying with backoff clears most of
// them without the user having to resubmit the whole form. If retries are
// exhausted we rewrite the error into a short, user-facing message instead
// of leaking the raw `{"error":{"code":503,...}}` JSON blob from the SDK.
const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const FRIENDLY_MESSAGES = {
  429: "The AI model hit a rate limit. Please wait a moment and try again.",
  500: "The AI service is temporarily unavailable. Please try again shortly.",
  503: "The AI model is currently overloaded with requests. Please try again in a minute.",
};
const DAILY_QUOTA_MESSAGE =
  "Your Gemini API key has hit its daily request quota. It resets on Google's schedule (usually ~24h) — try again later, or use a different/upgraded API key.";

// err.message on a 429/5xx is the raw `JSON.stringify(errorBody)` from the
// SDK (see throwErrorIfNotOK) — parse it back out so we can tell a
// same-minute rate limit (worth retrying, often with a suggested delay)
// apart from an exhausted daily quota (no amount of in-request waiting
// will fix that).
function parseGeminiErrorBody(err) {
  try {
    return JSON.parse(err.message)?.error || null;
  } catch {
    return null;
  }
}

function isDailyQuotaExhausted(body) {
  return !!body?.details?.some(
    (d) => typeof d["@type"] === "string" && d["@type"].includes("QuotaFailure") && d.violations?.some((v) => /perday/i.test(v.quotaId || ""))
  );
}

function suggestedRetryDelayMs(body) {
  const info = body?.details?.find((d) => typeof d["@type"] === "string" && d["@type"].includes("RetryInfo"));
  const seconds = info?.retryDelay ? parseFloat(info.retryDelay) : null;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 60000) : null;
}

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
      if (!RETRYABLE_STATUSES.has(err.status) || attempt === retries) break;

      const body = err.status === 429 ? parseGeminiErrorBody(err) : null;
      if (err.status === 429 && isDailyQuotaExhausted(body)) {
        break; // retrying within this request can't fix a daily quota
      }
      const delay = suggestedRetryDelayMs(body) ?? baseDelayMs * 2 ** attempt;
      console.warn(`Gemini request failed (status ${err.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
      await sleep(delay);
    }
  }

  if (lastErr?.status === 429) {
    const body = parseGeminiErrorBody(lastErr);
    const message = isDailyQuotaExhausted(body) ? DAILY_QUOTA_MESSAGE : FRIENDLY_MESSAGES[429];
    const e = new Error(message);
    e.status = 429;
    e.userFacing = true;
    throw e;
  }
  const friendly = FRIENDLY_MESSAGES[lastErr?.status];
  if (friendly) {
    const e = new Error(friendly);
    e.status = lastErr.status;
    e.userFacing = true;
    throw e;
  }
  throw lastErr;
}

// LaTeX (now requested in the prompt for formulas/math) is full of single
// backslashes — \delta, \times, \Sigma — which are invalid inside a JSON
// string unless doubled, and Gemini doesn't always escape them correctly.
// jsonrepair fixes most malformed-JSON issues (raw newlines, trailing
// commas, stray text around the object) but *drops* unrecognized escapes
// like "\S" rather than preserving them — which would silently mangle
// LaTeX commands. So we double any invalid backslash escape ourselves
// first (preserving the backslash), then hand the result to jsonrepair
// for everything else.
function fixInvalidJsonEscapes(text) {
  return text.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\");
}

function extractJson(text) {
  if (!text) throw new Error("Gemini returned an empty response.");

  const cleaned = fixInvalidJsonEscapes(text.trim());

  try {
    return JSON.parse(jsonrepair(cleaned));
  } catch (err) {
    throw new Error(`Gemini did not return valid JSON: ${err.message}`);
  }
}

// Content counts (quiz, flashcards, ...) scale with material size, so we
// can't check for one exact number. Instead check each array is present and
// within a generous range around the target we asked for — this still
// catches a genuinely broken response (empty array, wildly off) without
// failing the whole generation over Gemini producing 7 questions instead of
// the suggested 6.
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
// options verbatim. Gemini sometimes paraphrases it slightly — repair via a
// case/whitespace-insensitive match before giving up on the item entirely.
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

// Sections beyond the 5 count-scaled ones (quiz/flashcards/etc.) were
// previously not validated at all — an omitted or malformed
// summary/core_concepts/chatbot_context/etc. would still be marked
// "completed". These checks default soft-missing/malformed sections to safe
// empty values rather than failing generation outright, since none of them
// are as user-blocking as a broken quiz/flashcard.
function validateAuxiliarySections(pkg, warnings) {
  if (!pkg.study_scaffolding || typeof pkg.study_scaffolding !== "object") {
    warnings.push("study_scaffolding missing or malformed — defaulted.");
    pkg.study_scaffolding = { mental_model_anchor: "", cognitive_roadmap: [], retention_strategy: "" };
  }

  if (!Array.isArray(pkg.summary)) {
    warnings.push("summary missing or malformed — defaulted to empty array.");
    pkg.summary = [];
  } else {
    pkg.summary = pkg.summary.filter((c) => isNonEmptyString(c?.topic_title) && isNonEmptyString(c?.description));
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

function validatePackage(pkg, counts) {
  if (!pkg.metadata?.video_title) {
    throw new Error("Missing metadata.video_title");
  }

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
  validateAuxiliarySections(pkg, warnings);

  if (warnings.length) console.warn("Study package validation warnings:", warnings);

  return pkg;
}

export async function generateStudyPackage(input, ctx = {}) {
  try {
    console.log("Generating study package...");

    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,

          contents: buildUserMessage(input),

          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: MAX_OUTPUT_TOKENS.full,
          },
        }),
        CALL_TIMEOUT_MS.full,
        "study package generation"
      )
    );
    assertNotTruncated(result, "the study package");
    logAiUsage(result, { ...ctx, kind: "generate" });

    const text = result.text;

    const pkg = extractJson(text);

    validatePackage(pkg, suggestedCounts(input.transcript.length));

    return pkg;
  } catch (err) {
    console.error("Gemini generation error:");
    console.error(err);

    throw err;
  }
}

export async function generateStudyPackageFromSources(input, ctx = {}) {
  try {
    console.log(`Generating study package from ${input.sources.length} source(s)...`);

    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,

          contents: buildMultiSourceUserMessage(input),

          config: {
            systemInstruction: SYSTEM_PROMPT + "\n" + MULTI_SOURCE_INSTRUCTIONS,
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: MAX_OUTPUT_TOKENS.full,
          },
        }),
        CALL_TIMEOUT_MS.full,
        "study package generation"
      )
    );
    assertNotTruncated(result, "the study package");
    logAiUsage(result, { ...ctx, kind: "generate_multi_source" });

    const totalChars = input.sources.reduce((sum, s) => sum + (s.extracted_text?.length || 0), 0);
    const pkg = extractJson(result.text);
    validatePackage(pkg, suggestedCounts(totalChars));
    return pkg;
  } catch (err) {
    console.error("Gemini multi-source generation error:");
    console.error(err);
    throw err;
  }
}

export async function extractImageText(buffer, mimeType, ctx = {}) {
  try {
    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,
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
          config: { maxOutputTokens: MAX_OUTPUT_TOKENS.image },
        }),
        CALL_TIMEOUT_MS.image,
        "image extraction"
      )
    );
    assertNotTruncated(result, "the image transcription");
    logAiUsage(result, { ...ctx, kind: "image_extract" });
    return result.text;
  } catch (err) {
    console.error("Gemini image extraction error:");
    console.error(err);
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
  if (value === undefined) throw new Error(`Gemini response is missing "${key}".`);

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

export async function regenerateSection(pkgDoc, section) {
  if (!REGENERATABLE_SECTIONS[section]) {
    throw new Error(`"${section}" is not a regeneratable section.`);
  }
  if (!pkgDoc.raw_transcript) {
    throw new Error("Original transcript is unavailable for regeneration.");
  }

  try {
    const counts = suggestedCounts(pkgDoc.raw_transcript.length);
    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: buildRegenerateUserMessage({
            video_title: pkgDoc.metadata?.video_title,
            subject: pkgDoc.metadata?.subject,
            transcript: pkgDoc.raw_transcript,
          }),
          config: {
            systemInstruction: buildRegenerateSystemPrompt(section, counts, (pkgDoc.sources?.length || 0) > 1),
            responseMimeType: "application/json",
            responseSchema: REGENERATE_RESPONSE_SCHEMAS[section],
            temperature: 0.5,
            maxOutputTokens: MAX_OUTPUT_TOKENS.section,
          },
        }),
        CALL_TIMEOUT_MS.section,
        `regenerating ${section}`
      )
    );
    assertNotTruncated(result, `the regenerated ${section} section`);
    logAiUsage(result, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "regenerate" });

    const data = extractJson(result.text);
    return { key: REGENERATABLE_SECTIONS[section].key, value: validateSection(section, data, counts) };
  } catch (err) {
    console.error(`Gemini regenerate (${section}) error:`);
    console.error(err);
    throw err;
  }
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

    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: { temperature: 0.5, maxOutputTokens: MAX_OUTPUT_TOKENS.explain },
        }),
        CALL_TIMEOUT_MS.explain,
        "concept explanation"
      )
    );
    assertNotTruncated(result, "the explanation");
    logAiUsage(result, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "explain" });

    return result.text;
  } catch (err) {
    console.error("Gemini explain error:");
    console.error(err);
    throw err;
  }
}

export async function chatAboutLecture(pkgDoc, messages) {
  try {
    // Native multi-turn `contents` (role per turn) instead of flattening the
    // whole conversation into one "user: ...\nassistant: ..." text blob —
    // the model reasons over actual conversation turns rather than parsing
    // role labels out of a wall of text.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await callGemini(() =>
      withTimeout(
        ai.models.generateContent({
          model: MODEL,

          contents,

          config: {
            systemInstruction: buildChatSystemPrompt(pkgDoc),
            maxOutputTokens: MAX_OUTPUT_TOKENS.chat,
          },
        }),
        CALL_TIMEOUT_MS.chat,
        "chat reply"
      )
    );
    assertNotTruncated(result, "the chat reply");
    logAiUsage(result, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "chat" });

    return result.text;
  } catch (err) {
    console.error("Gemini chat error:");
    console.error(err);

    throw err;
  }
}