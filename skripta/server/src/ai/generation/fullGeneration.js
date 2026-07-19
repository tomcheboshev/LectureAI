// Full single-call generation path — for small/typical inputs, the model
// reads everything and writes everything in one request. Its result now
// flows through the same soft-validation + automatic recovery pipeline as
// the chunked path (packageValidator + recoveryManager), instead of the old
// all-or-nothing validatePackage that discarded every good section the
// moment one section failed.

import { SYSTEM_PROMPT, buildUserMessage, suggestedCounts } from "../../prompt/index.js";
import { extractJson } from "../pipeline/jsonRepair.js";
import { validateSections } from "../pipeline/packageValidator.js";
import { recoverInvalidSections } from "../pipeline/recoveryManager.js";
import { callAi, buildMessages, MAX_OUTPUT_TOKENS, CALL_TIMEOUT_MS, assertNotTruncated } from "./callAi.js";
import { logAiUsage } from "../usageLogger.js";

export async function generateStudyPackage(input, ctx = {}, images = []) {
  try {
    console.log("Generating study package...");

    const response = await callAi({
      system: SYSTEM_PROMPT,
      messages: buildMessages(buildUserMessage({ ...input, images }), images),
      maxTokens: MAX_OUTPUT_TOKENS.full,
      timeoutMs: CALL_TIMEOUT_MS.full,
      label: "study package generation",
      json: true,
    });
    console.log(
      `[generate] model=${response.model} promptChars=${input.transcript.length} responseChars=${response.text.length} finishReason=${response.finishReason} durationMs=${response.durationMs}`
    );
    assertNotTruncated(response, "the study package");
    logAiUsage(response, { ...ctx, kind: "generate" });

    const counts = suggestedCounts(input.transcript.length);
    const rawPkg = extractJson(response.text);
    const { pkg, sections } = validateSections(rawPkg, counts, images);

    return await recoverInvalidSections(
      {
        pkg,
        sections,
        counts,
        video_title: input.video_title,
        subject: input.subject,
        transcript: input.transcript,
        isMultiSource: false,
      },
      ctx
    );
  } catch (err) {
    console.error("AI generation error:", err);
    throw err;
  }
}
