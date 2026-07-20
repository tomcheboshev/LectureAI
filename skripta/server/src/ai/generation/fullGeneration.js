// Full single-call-pair generation path — for small/typical inputs. SPEED:
// rather than one call generating the entire package serially (summary
// through glossary, ~16k output tokens), this fires the TEACHING half
// (summary/concepts/notes, the only half that needs images) and the
// ASSESSMENT half (quiz/flashcards/practice/etc., text-only) as two
// INDEPENDENT calls — wall-clock time is roughly the slower of the two
// instead of the sum of both. The merged result flows through the same
// soft-validation + automatic recovery pipeline (packageValidator +
// recoveryManager) as before.
//
// Promise.allSettled (not Promise.all): if one half fails after every
// retry inside callAi, the other half's real content is kept rather than
// discarded — the missing half's sections come back empty, which
// packageValidator flags and recoveryManager then repairs one section at a
// time (including "summary" itself, if TEACHING was the half that failed —
// recoveryManager already treats an unrecoverable summary as fatal, so
// this doesn't weaken that guarantee, it just gives recovery an actual
// chance to run first instead of failing immediately with no attempt).

import { TEACHING_SYSTEM_PROMPT, ASSESSMENT_SYSTEM_PROMPT, buildUserMessage, suggestedCounts } from "../../prompt/index.js";
import { extractJson } from "../pipeline/jsonRepair.js";
import { validateSections } from "../pipeline/packageValidator.js";
import { recoverInvalidSections } from "../pipeline/recoveryManager.js";
import { callAi, buildMessages, MAX_OUTPUT_TOKENS, CALL_TIMEOUT_MS, assertNotTruncated } from "./callAi.js";
import { logAiUsage } from "../usageLogger.js";

// Runs one half of the split full-generation call. `withImages` is only
// true for the teaching half — the assessment half never references images,
// so omitting them here also keeps that call's payload (and cost) smaller.
async function generateHalf(half, system, input, ctx, images, ownImages) {
  const response = await callAi({
    system,
    messages: buildMessages(buildUserMessage({ ...input, images: ownImages }), ownImages),
    maxTokens: MAX_OUTPUT_TOKENS[half],
    timeoutMs: CALL_TIMEOUT_MS[half],
    label: `study package generation (${half})`,
    json: true,
  });
  console.log(
    `[generate:${half}] model=${response.model} promptChars=${input.transcript.length} responseChars=${response.text.length} finishReason=${response.finishReason} durationMs=${response.durationMs}`
  );
  assertNotTruncated(response, `the ${half} half of the study package`);
  logAiUsage(response, { ...ctx, kind: "generate" });
  return extractJson(response.text);
}

export async function generateStudyPackage(input, ctx = {}, images = []) {
  try {
    console.log("Generating study package (teaching + assessment, in parallel)...");

    const [teachingResult, assessmentResult] = await Promise.allSettled([
      generateHalf("teaching", TEACHING_SYSTEM_PROMPT, input, ctx, images, images),
      generateHalf("assessment", ASSESSMENT_SYSTEM_PROMPT, input, ctx, images, []),
    ]);

    if (teachingResult.status === "rejected" && assessmentResult.status === "rejected") {
      throw teachingResult.reason;
    }
    if (teachingResult.status === "rejected") {
      console.warn(`[generate] teaching half failed (assessment succeeded) — continuing with assessment only: ${teachingResult.reason.message}`);
    }
    if (assessmentResult.status === "rejected") {
      console.warn(`[generate] assessment half failed (teaching succeeded) — continuing with teaching only: ${assessmentResult.reason.message}`);
    }

    const counts = suggestedCounts(input.transcript.length);
    const rawPkg = {
      ...(teachingResult.status === "fulfilled" ? teachingResult.value : {}),
      ...(assessmentResult.status === "fulfilled" ? assessmentResult.value : {}),
    };
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
