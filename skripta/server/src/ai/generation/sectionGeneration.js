// Single-section AI call — the one and only section-regeneration code path
// in the whole app. Takes plain data (not a Mongoose document) so it can be
// called from two very different places with the same logic: the manual
// POST /api/packages/:id/regenerate route (a thin wrapper in routes/packages.js
// pulls the plain fields off the saved doc), and recoveryManager.js
// (automatic recovery of a section that failed validation during initial
// generation). Previously this logic only existed inside the manual route's
// handler, which is exactly what made "regenerate just the bad section
// automatically" impossible without duplicating it.

import { REGENERATABLE_SECTIONS, buildRegenerateSystemPrompt, buildRegenerateUserMessage, suggestedCounts } from "../../prompt/index.js";
import { extractJson } from "../pipeline/jsonRepair.js";
import { validateSectionValue } from "../pipeline/packageValidator.js";
import { MAX_CHUNK_ATTEMPTS } from "../pipeline/chunking.js";
import { callAi, MAX_OUTPUT_TOKENS, CALL_TIMEOUT_MS, sleep } from "./callAi.js";
import { logAiUsage } from "../usageLogger.js";

/**
 * @param {object} input
 * @param {string} input.section - a key of REGENERATABLE_SECTIONS.
 * @param {object} [input.counts] - suggestedCounts() result; derived from `transcript` if omitted.
 * @param {boolean} [input.isMultiSource]
 * @param {string} [input.video_title]
 * @param {string} [input.subject]
 * @param {string} input.transcript - the original raw transcript this package was generated from.
 * @param {object} [ctx] - { ownerId, packageId } for usage logging.
 * @returns {Promise<{key: string, value: *}>}
 */
export async function regenerateSectionCore({ section, counts, isMultiSource = false, video_title, subject, transcript }, ctx = {}) {
  if (!REGENERATABLE_SECTIONS[section]) {
    throw new Error(`"${section}" is not a regeneratable section.`);
  }
  if (!transcript) {
    throw new Error("Original transcript is unavailable for regeneration.");
  }

  const resolvedCounts = counts || suggestedCounts(transcript.length);
  const key = REGENERATABLE_SECTIONS[section].key;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const response = await callAi({
        system: buildRegenerateSystemPrompt(section, resolvedCounts, isMultiSource),
        messages: [{ role: "user", text: buildRegenerateUserMessage({ video_title, subject, transcript }) }],
        maxTokens: MAX_OUTPUT_TOKENS.section,
        timeoutMs: CALL_TIMEOUT_MS.section,
        label: `regenerating ${section}`,
        json: true,
      });
      console.log(
        `[regenerate] section=${section} model=${response.model} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} finishReason=${response.finishReason} durationMs=${response.durationMs}`
      );
      logAiUsage(response, { ...ctx, kind: "regenerate" });

      const data = extractJson(response.text);
      return { key, value: validateSectionValue(section, data[key], resolvedCounts) };
    } catch (err) {
      lastErr = err;
      console.warn(`[regenerate] section=${section} attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (err.permanent) break;
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  console.error(`AI regenerate (${section}) error:`, lastErr);
  throw lastErr;
}
