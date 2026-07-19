// Simple one-off AI calls with no chunking/recovery concerns: transcribing
// one image, explaining a concept on demand, and replying in the lecture
// chatbot. Each is a single call/response — nothing here needs the
// validation or recovery machinery the study-package generation paths do.

import { buildExplainPrompt, buildChatSystemPrompt } from "../../prompt/index.js";
import { callAi, MAX_OUTPUT_TOKENS, CALL_TIMEOUT_MS, assertNotTruncated } from "./callAi.js";
import { logAiUsage } from "../usageLogger.js";

export async function extractImageText(buffer, mimeType, ctx = {}) {
  try {
    const response = await callAi({
      messages: [
        {
          role: "user",
          text: "Transcribe every piece of text visible in this image (including handwriting), and describe any diagrams, tables, charts or formulas in detail. If this looks like a slide, include its title and all bullet points in order. Plain text output, no markdown.",
          images: [{ mimeType, base64: buffer.toString("base64") }],
        },
      ],
      maxTokens: MAX_OUTPUT_TOKENS.image,
      timeoutMs: CALL_TIMEOUT_MS.image,
      label: "image extraction",
    });
    console.log(`[image_extract] model=${response.model} finishReason=${response.finishReason} durationMs=${response.durationMs}`);
    assertNotTruncated(response, "the image transcription");
    logAiUsage(response, { ...ctx, kind: "image_extract" });
    return response.text;
  } catch (err) {
    console.error("AI image extraction error:", err);
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

    const response = await callAi({
      messages: [{ role: "user", text: prompt }],
      maxTokens: MAX_OUTPUT_TOKENS.explain,
      timeoutMs: CALL_TIMEOUT_MS.explain,
      label: "concept explanation",
    });
    console.log(`[explain] model=${response.model} finishReason=${response.finishReason} durationMs=${response.durationMs}`);
    assertNotTruncated(response, "the explanation");
    logAiUsage(response, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "explain" });

    return response.text;
  } catch (err) {
    console.error("AI explain error:", err);
    throw err;
  }
}

export async function chatAboutLecture(pkgDoc, messages) {
  try {
    // This app's own chat history already stores "user"/"assistant" — the
    // same roles the provider-neutral turn shape expects, so no role
    // translation is needed on the way in or out.
    const chatMessages = messages.map((m) => ({ role: m.role, text: m.content }));

    const response = await callAi({
      system: buildChatSystemPrompt(pkgDoc),
      messages: chatMessages,
      maxTokens: MAX_OUTPUT_TOKENS.chat,
      timeoutMs: CALL_TIMEOUT_MS.chat,
      label: "chat reply",
    });
    console.log(`[chat] model=${response.model} finishReason=${response.finishReason} durationMs=${response.durationMs}`);
    assertNotTruncated(response, "the chat reply");
    logAiUsage(response, { ownerId: pkgDoc.owner, packageId: pkgDoc._id, kind: "chat" });

    return response.text;
  } catch (err) {
    console.error("AI chat error:", err);
    throw err;
  }
}
