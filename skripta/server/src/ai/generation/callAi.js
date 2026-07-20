// Shared low-level "make one AI call" helper — every generation file
// (fullGeneration, chunkedGeneration, sectionGeneration, chatAndExplain)
// goes through this instead of each hand-rolling its own
// estimate-then-rate-limit-then-call sequence. Centralizes: input-token
// estimation (to feed the rate limiter's TPM budget), routing the call
// through the AIProvider abstraction (never a concrete provider directly),
// and the per-call-type output ceilings/timeouts every caller needs.

import { getProvider } from "../provider/index.js";
import { acquireRateLimitSlot } from "../rateLimiter.js";
import { estimateTokensFromChars } from "../provider/openrouter.js";

// Per-call-type output ceilings and timeouts. Without an explicit maxTokens,
// a large package (many quiz/flashcard items, full worked solutions) has no
// ceiling and no detection of truncation; without a timeout, a single hung
// call can occupy one of the job queue's only concurrency slots
// indefinitely. Background job queue calls, not blocking HTTP requests, so
// a long-running call doesn't tie up a client — but meaningfully bounded so
// one call can't both run long AND have unlimited room to make that worse.
//
// SPEED: `teaching` and `assessment` replace the old monolithic `full`/
// `synthesis` ceilings (16000 tokens each, generated serially in one
// response) — fullGeneration.js and chunkedGeneration.js now fire both
// halves as parallel calls (see their own comments), so each half only
// needs to cover its own, smaller share of the total content. Token
// generation is roughly linear in count, so halving the per-call ceiling
// and running the two calls concurrently cuts real wall-clock time by
// close to half, not just the ceiling. `chunk` generates only a handful of
// summary chapters for one piece of source text; `section` regenerates
// exactly one section.
export const MAX_OUTPUT_TOKENS = { teaching: 9000, assessment: 9000, section: 8000, explain: 1536, chat: 2048, image: 2048, chunk: 7000 };
export const CALL_TIMEOUT_MS = { teaching: 120000, assessment: 120000, section: 90000, explain: 30000, chat: 60000, image: 60000, chunk: 120000 };

export function isTruncated(response) {
  return response?.finishReason === "length";
}

// "length" means the response was cut off mid-stream by hitting maxTokens —
// left unchecked, this surfaces as a generic "did not return valid JSON"
// error with no indication of the actual cause. "content_filter" means the
// model declined or blocked the response outright — parsing an empty
// response as JSON would otherwise fail with an equally unhelpful message.
export function assertNotTruncated(response, label) {
  if (response?.finishReason === "length") {
    const err = new Error(`The AI's response for ${label} was cut off before it finished. Please try again.`);
    err.truncated = true;
    err.userFacing = true;
    throw err;
  }
  if (response?.finishReason === "content_filter") {
    const err = new Error(`The AI declined to generate ${label} for this material (safety/content filter). Try different source material.`);
    err.userFacing = true;
    throw err;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Builds a single provider-neutral "turn": the text prompt plus each
// extracted image (in manifest order, matching the "IMG<n>" ids the
// prompt's image manifest promised) — the model can only ground an
// "images[].id" reference in a chapter if it actually received the
// corresponding bytes.
export function buildMessages(promptText, images) {
  return [{ role: "user", text: promptText, images }];
}

// Rough, deliberately conservative input-token estimate used only to feed
// the rate limiter's TPM budget and for diagnostic logging — NOT a billing
// figure (usageLogger.js logs the real prompt token count the API reports
// back after the call, which is authoritative). Images have no cheap way to
// know their exact token cost without decoding dimensions, so this
// approximates from the base64 payload size, floored at the documented
// ~258-token minimum per image (matching most vision models' per-tile floor).
function estimateTokens(messages, systemText) {
  let chars = systemText ? systemText.length : 0;
  let imageBytesTotal = 0;
  let imageCount = 0;
  for (const turn of messages || []) {
    if (typeof turn.text === "string") chars += turn.text.length;
    for (const img of turn.images || []) {
      imageCount++;
      imageBytesTotal += img.base64.length * 0.75; // base64 -> raw bytes
    }
  }
  const textTokens = estimateTokensFromChars(chars);
  const imageTokens = imageCount * 258 + Math.ceil(imageBytesTotal / 2000);
  return textTokens + imageTokens;
}

export async function callAi({ system, messages, maxTokens, timeoutMs, label, json }) {
  const payloadChars = JSON.stringify(messages).length;
  const estimatedInputTokens = estimateTokens(messages, system);
  console.log(
    `[pipeline] Building prompt: ${label} (${system ? system.length : 0} system chars, ${payloadChars} content chars, ~${estimatedInputTokens} est. input tokens)`
  );

  // Blocks here (potentially for seconds) until the process-wide rate
  // limiter has RPM/TPM budget for this call — see rateLimiter.js for why
  // per-generation concurrency caps alone aren't enough.
  await acquireRateLimitSlot(estimatedInputTokens + maxTokens, label);

  const provider = getProvider();
  return provider.chatComplete({
    system,
    messages,
    maxTokens,
    timeoutMs,
    label,
    responseFormat: json ? "json" : undefined,
  });
}
