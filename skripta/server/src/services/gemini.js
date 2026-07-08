import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, buildUserMessage } from "../prompt.js";

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