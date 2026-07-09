import { GoogleGenAI } from "@google/genai";
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

function extractJson(text) {
  if (!text) throw new Error("Gemini returned an empty response.");

  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("Gemini did not return valid JSON.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
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