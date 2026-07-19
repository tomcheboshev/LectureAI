// Chunked generation path — for large multi-file / large single-source
// inputs. See prompt/builders.js's comment above SUMMARY_CHUNK_SYSTEM_PROMPT
// for why this exists: a single call asking the model to both read
// everything and write everything reliably times out once the
// input/expected-output grows large enough. This splits into small calls
// (one per source, or several per source once the source itself is large —
// see chunking.js's splitTextIntoChunks) each producing only summary
// chapters, plus one synthesis call (everything else, working from the now-
// compact merged summary instead of raw transcripts) — every individual
// call's input and output stays bounded regardless of how many files or how
// large the material is. The final merge flows through the same
// packageValidator + recoveryManager pipeline as the full-generation path —
// no duplicated validation logic between the two.

import {
  suggestedCounts,
  buildSummaryChunkSystemPrompt,
  buildSummaryChunkUserMessage,
  buildSynthesisSystemPrompt,
  buildSynthesisUserMessage,
  buildDistilledSummaryText,
} from "../../prompt/index.js";
import { extractJson } from "../pipeline/jsonRepair.js";
import { isNonEmptyString, sanitizeChapterImages, sanitizeChapterFormulas } from "../pipeline/sectionValidators.js";
import { validateSections } from "../pipeline/packageValidator.js";
import { recoverInvalidSections } from "../pipeline/recoveryManager.js";
import { CHARS_PER_TOKEN, CHUNK_MAX_INPUT_TOKENS, CHUNK_MAX_CHARS, IMAGE_TOKEN_ESTIMATE, MAX_CHUNK_ATTEMPTS, CHUNK_CONCURRENCY, splitTextIntoChunks } from "../pipeline/chunking.js";
import { callAi, buildMessages, MAX_OUTPUT_TOKENS, CALL_TIMEOUT_MS, isTruncated, sleep } from "./callAi.js";
import { logAiUsage } from "../usageLogger.js";

// Generates summary chapters for one piece of source text.
//  1. Try to parse the response even when finishReason="length" (truncated)
//     — jsonrepair frequently recovers a valid partial array by dropping
//     only the incomplete trailing entry, so a "truncated" response often
//     still yields several perfectly good chapters rather than zero.
//  2. If that yields nothing usable, retry the identical request once more.
//     A permanent failure (wrong model config, quota exhaustion, a
//     content-safety block) skips straight to giving up — no amount of
//     retrying fixes those, and there is no split-and-recurse fallback: a
//     chunk that fails every attempt is given up on, not fed back in
//     progressively smaller pieces (see chunking.js's AI_CHUNK_MAX_SPLIT_DEPTH).
// `abortState` is shared across every chunk of the same generation — once
// any one of them hits a genuine quota exhaustion, every other queued/
// in-flight chunk sees it and stops immediately instead of independently
// re-discovering the same account-wide problem.
async function generateChunkChapters(source, chunkText, label, ctx, chunkImages, abortState) {
  if (abortState?.stopped) throw Object.assign(new Error(`${label}: skipped — generation already aborted (${abortState.reason})`), { aborted: true });

  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const response = await callAi({
        system: buildSummaryChunkSystemPrompt(),
        messages: buildMessages(
          buildSummaryChunkUserMessage({ video_title: ctx.video_title, subject: ctx.subject, source: { ...source, extracted_text: chunkText }, images: chunkImages }),
          chunkImages
        ),
        maxTokens: MAX_OUTPUT_TOKENS.chunk,
        timeoutMs: CALL_TIMEOUT_MS.chunk,
        label: `summarizing ${label}`,
        json: true,
      });
      console.log(
        `[chunk] ${label} model=${response.model} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} promptChars=${chunkText.length} responseChars=${response.text.length} finishReason=${response.finishReason} durationMs=${response.durationMs}`
      );
      logAiUsage(response, { ...ctx, kind: "generate_chunk" });

      let data;
      try {
        data = extractJson(response.text);
      } catch (parseErr) {
        throw Object.assign(new Error(`${label}: ${isTruncated(response) ? "truncated and unparseable" : `invalid JSON (${parseErr.message})`}`), {
          truncated: isTruncated(response),
        });
      }

      const validImageIds = new Set(chunkImages.map((img) => img.id));
      const chapters = (Array.isArray(data.summary) ? data.summary : [])
        .filter((c) => isNonEmptyString(c?.topic_title) && isNonEmptyString(c?.description))
        .map((c) => ({
          ...c,
          source_index: source.order,
          source_title: source.filename.replace(/\.[^.]+$/, ""),
          images: sanitizeChapterImages(c.images, validImageIds, []),
          formulas: sanitizeChapterFormulas(c.formulas, []),
        }));

      if (chapters.length === 0) throw new Error(`${label}: response parsed but contained no usable chapters`);

      if (isTruncated(response)) {
        console.warn(`[chunk] ${label} was truncated but salvaged ${chapters.length} chapter(s) via jsonrepair.`);
      }
      return { chapters, corrections: Array.isArray(data.transcription_corrections) ? data.transcription_corrections : [] };
    } catch (err) {
      lastErr = err;
      if (err.quotaExhausted && abortState) {
        abortState.stopped = true;
        abortState.reason = err.message;
      }
      console.warn(`[chunk] ${label} attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (err.permanent) break;
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }

  throw lastErr;
}

async function generateSynthesisWithRetry({ video_title, subject, difficulty, distilledSummary, counts }, ctx) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      const response = await callAi({
        system: buildSynthesisSystemPrompt(),
        messages: [{ role: "user", text: buildSynthesisUserMessage({ video_title, subject, difficulty, distilledSummary, counts }) }],
        maxTokens: MAX_OUTPUT_TOKENS.synthesis,
        timeoutMs: CALL_TIMEOUT_MS.synthesis,
        label: "study package synthesis",
        json: true,
      });
      console.log(
        `[synthesis] model=${response.model} attempt=${attempt}/${MAX_CHUNK_ATTEMPTS} promptChars=${distilledSummary.length} responseChars=${response.text.length} finishReason=${response.finishReason} durationMs=${response.durationMs}`
      );
      logAiUsage(response, { ...ctx, kind: "generate_synthesis" });

      // Same salvage-first philosophy as generateChunkChapters: jsonrepair
      // can often recover a partial object (e.g. quiz intact, flashcards
      // array truncated) by dropping only the incomplete trailing entry —
      // the soft validator downstream already tolerates missing/malformed
      // sections gracefully (and recovers them), so a partial synthesis
      // result is still worth using rather than discarding outright.
      try {
        return extractJson(response.text);
      } catch (parseErr) {
        throw Object.assign(new Error(`synthesis: ${isTruncated(response) ? "truncated and unparseable" : `invalid JSON (${parseErr.message})`}`), {
          truncated: isTruncated(response),
        });
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[synthesis] attempt ${attempt}/${MAX_CHUNK_ATTEMPTS} failed: ${err.message}`);
      if (err.permanent) break;
      if (attempt < MAX_CHUNK_ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastErr;
}

// Runs `worker(item, index)` over `items` with at most `limit` concurrently
// in flight — plain Promise.all would fire every source's summary call at
// once, which for a large multi-file upload is a fast way to blow through
// the API key's per-minute rate limit before any of them finish.
// `abortState` (when given) is checked before starting each new item —
// once one item signals a genuine quota exhaustion, every item not yet
// started is skipped immediately instead of independently making (and
// failing) its own call against an account already known to be out of
// quota.
async function runWithConcurrency(items, limit, worker, abortState) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      if (abortState?.stopped) {
        results[i] = await worker(items[i], i, true);
        continue;
      }
      results[i] = await worker(items[i], i, false);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

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
  //
  // Sized by a single TOKEN budget covering both text and images together —
  // not a flat character count blind to image cost. A source with light
  // text but several embedded diagrams has a real request cost dominated by
  // the images (each ≈258+ tokens), which a char-only budget would
  // completely miss and pack them all into one oversized call anyway.
  const workItems = sources.flatMap((source) => {
    const sourceImages = images.filter((img) => img.sourceIndex === source.order);
    const textTokens = Math.ceil(source.extracted_text.length / CHARS_PER_TOKEN);
    const imageTokens = sourceImages.length * IMAGE_TOKEN_ESTIMATE;
    const totalTokens = textTokens + imageTokens;
    const minPieces = Math.max(1, Math.ceil(totalTokens / CHUNK_MAX_INPUT_TOKENS));
    const effectiveMaxChars = minPieces > 1 ? Math.min(CHUNK_MAX_CHARS, Math.ceil(source.extracted_text.length / minPieces) || CHUNK_MAX_CHARS) : CHUNK_MAX_CHARS;
    const pieces = splitTextIntoChunks(source.extracted_text, effectiveMaxChars);
    return pieces.map((text, chunkIndex) => ({
      source,
      text,
      chunkIndex,
      chunkCount: pieces.length,
      images: sourceImages.filter((_, i) => i % pieces.length === chunkIndex),
    }));
  });
  console.log(
    `[chunked-generation] ${sources.length} source(s) split into ${workItems.length} work item(s): ${workItems
      .map((w) => `${w.source.filename}[${w.chunkIndex + 1}/${w.chunkCount}]${w.images.length ? ` +${w.images.length}img` : ""}`)
      .join(", ")}`
  );

  // Shared across every work item in this generation — the moment one hits
  // a genuine quota exhaustion, every other item (already in flight or
  // still queued) stops immediately instead of each independently burning
  // its own attempts against an account already known to be out of quota.
  const abortState = { stopped: false, reason: null };

  const results = await runWithConcurrency(
    workItems,
    CHUNK_CONCURRENCY,
    async (item, _index, alreadyAborted) => {
      const label = item.chunkCount > 1 ? `"${item.source.filename}" (part ${item.chunkIndex + 1}/${item.chunkCount})` : `"${item.source.filename}"`;
      if (alreadyAborted) {
        console.warn(`[chunked-generation] Skipping ${label} — generation already aborted (${abortState.reason}).`);
        return { ok: false, source: item.source, error: abortState.reason, aborted: true };
      }
      try {
        const r = await generateChunkChapters(item.source, item.text, label, { ...ctx, video_title, subject }, item.images, abortState);
        return { ok: true, source: item.source, ...r };
      } catch (err) {
        console.warn(`[chunked-generation] Giving up on ${label} — every recovery attempt failed:`, err.message);
        return { ok: false, source: item.source, error: err.message, aborted: Boolean(err.quotaExhausted) };
      }
    },
    abortState
  );

  // A quota exhaustion overrides everything else below — per the product
  // requirement, stop immediately and report the clear, user-facing quota
  // message rather than the generic "could not generate content" failure,
  // even if a few chunks had already succeeded before the exhaustion hit.
  if (abortState.stopped) {
    throw Object.assign(new Error(abortState.reason || "AI quota temporarily exhausted. Please try again later."), { userFacing: true });
  }

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

  const rawPkg = { ...synthesis, summary: allChapters, transcription_corrections: allCorrections };
  if (!rawPkg.metadata) rawPkg.metadata = {};
  if (!isNonEmptyString(rawPkg.metadata.video_title)) rawPkg.metadata.video_title = video_title || "Untitled Lecture";

  const { pkg, sections } = validateSections(rawPkg, counts, images);
  const isMultiSource = sources.length > 1;
  // Matches routes/packages.js's own combinedText/raw_transcript format
  // exactly ("=== SOURCE N: filename ===" markers) — buildRegenerateSystemPrompt's
  // MULTI_SOURCE_INSTRUCTIONS (and the "summary" section's source_index/
  // source_title tagging) depend on seeing those same markers during recovery.
  const fullTranscript = sources.map((s) => `=== SOURCE ${s.order}: ${s.filename} ===\n${s.extracted_text}`).join("\n\n");

  return await recoverInvalidSections({ pkg, sections, counts, video_title, subject, transcript: fullTranscript, isMultiSource }, ctx);
}
