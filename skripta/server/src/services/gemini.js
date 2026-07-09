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
  suggestedCounts,
} from "../prompt.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(fn, { retries = 3, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!RETRYABLE_STATUSES.has(err.status) || attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`Gemini request failed (status ${err.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
      await sleep(delay);
    }
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

function validatePackage(pkg, counts) {
  if (!pkg.metadata?.video_title) {
    throw new Error("Missing metadata.video_title");
  }

  for (const [field, countKey] of Object.entries(SCALED_SECTIONS)) {
    const arr = pkg[field];
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error(`"${field}" must be a non-empty array.`);
    }
    if (!withinRange(arr.length, counts[countKey])) {
      throw new Error(`"${field}" has ${arr.length} items — expected roughly ${counts[countKey]} for this amount of material.`);
    }
  }

  return pkg;
}

export async function generateStudyPackage(input) {
  try {
    console.log("Generating study package...");

    const result = await callGemini(() =>
      ai.models.generateContent({
        model: MODEL,

        contents: buildUserMessage(input),

        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      })
    );

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

export async function generateStudyPackageFromSources(input) {
  try {
    console.log(`Generating study package from ${input.sources.length} source(s)...`);

    const result = await callGemini(() =>
      ai.models.generateContent({
        model: MODEL,

        contents: buildMultiSourceUserMessage(input),

        config: {
          systemInstruction: SYSTEM_PROMPT + "\n" + MULTI_SOURCE_INSTRUCTIONS,
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      })
    );

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

export async function extractImageText(buffer, mimeType) {
  try {
    const result = await callGemini(() =>
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
      })
    );
    return result.text;
  } catch (err) {
    console.error("Gemini image extraction error:");
    console.error(err);
    throw err;
  }
}

function validateSection(section, data, counts) {
  const key = REGENERATABLE_SECTIONS[section].key;
  const value = data[key];
  if (value === undefined) throw new Error(`Gemini response is missing "${key}".`);

  const countKey = SCALED_SECTIONS[section];
  if (countKey) {
    if (!Array.isArray(value) || value.length === 0) {
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
      ai.models.generateContent({
        model: MODEL,
        contents: buildRegenerateUserMessage({
          video_title: pkgDoc.metadata?.video_title,
          subject: pkgDoc.metadata?.subject,
          transcript: pkgDoc.raw_transcript,
        }),
        config: {
          systemInstruction: buildRegenerateSystemPrompt(section, counts),
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      })
    );

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
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { temperature: 0.5 },
      })
    );

    return result.text;
  } catch (err) {
    console.error("Gemini explain error:");
    console.error(err);
    throw err;
  }
}

export async function chatAboutLecture(pkgDoc, messages) {
  try {
    const ctx = pkgDoc.chatbot_context || {};

    const prompt = `
Lecture:
${pkgDoc.metadata.video_title}

Subject:
${pkgDoc.metadata.subject}

Summary:
${pkgDoc.full_lecture_summary}

Overview:
${ctx.lecture_overview || ""}

Key takeaways:
${(ctx.key_takeaways || []).join("\n")}

Important terms:
${(ctx.important_terms || []).join(", ")}

Rules:
${(ctx.rules_formulas_or_methods || []).join("\n")}

Conversation:

${messages
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}
`;

    const result = await callGemini(() =>
      ai.models.generateContent({
        model: MODEL,

        contents: prompt,

        config: {
          systemInstruction:
            "You are an AI tutor. Answer ONLY questions about this lecture.",
        },
      })
    );

    return result.text;
  } catch (err) {
    console.error("Gemini chat error:");
    console.error(err);

    throw err;
  }
}