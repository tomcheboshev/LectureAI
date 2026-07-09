import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  REGENERATABLE_SECTIONS,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
  buildExplainPrompt,
} from "../prompt.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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

function validatePackage(pkg) {
  if (!pkg.metadata?.video_title) {
    throw new Error("Missing metadata.video_title");
  }

  if (!Array.isArray(pkg.quiz) || pkg.quiz.length !== 5) {
    throw new Error("Quiz must contain exactly 5 questions.");
  }

  return pkg;
}

export async function generateStudyPackage(input) {
  try {
    console.log("Generating study package...");

    const result = await ai.models.generateContent({
      model: MODEL,

      contents: buildUserMessage(input),

      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const text = result.text;

    const pkg = extractJson(text);

    validatePackage(pkg);

    return pkg;
  } catch (err) {
    console.error("Gemini generation error:");
    console.error(err);

    throw err;
  }
}

const EXACT_LENGTHS = { quiz: 5, practice_tasks: 3, true_false_questions: 5, short_answer_questions: 3 };

function validateSection(section, data) {
  const key = REGENERATABLE_SECTIONS[section].key;
  const value = data[key];
  if (value === undefined) throw new Error(`Gemini response is missing "${key}".`);

  const exactLength = EXACT_LENGTHS[section];
  if (exactLength && (!Array.isArray(value) || value.length !== exactLength)) {
    throw new Error(`"${key}" must contain exactly ${exactLength} items.`);
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
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: buildRegenerateUserMessage({
        video_title: pkgDoc.metadata?.video_title,
        subject: pkgDoc.metadata?.subject,
        transcript: pkgDoc.raw_transcript,
      }),
      config: {
        systemInstruction: buildRegenerateSystemPrompt(section),
        responseMimeType: "application/json",
        temperature: 0.5,
      },
    });

    const data = extractJson(result.text);
    return { key: REGENERATABLE_SECTIONS[section].key, value: validateSection(section, data) };
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

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.5 },
    });

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

    const result = await ai.models.generateContent({
      model: MODEL,

      contents: prompt,

      config: {
        systemInstruction:
          "You are an AI tutor. Answer ONLY questions about this lecture.",
      },
    });

    return result.text;
  } catch (err) {
    console.error("Gemini chat error:");
    console.error(err);

    throw err;
  }
}