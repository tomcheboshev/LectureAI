// Chunk Manager — sizing/splitting policy for the chunked generation path
// (large multi-file / large single-source inputs). See prompt/builders.js's
// comment above SUMMARY_CHUNK_SYSTEM_PROMPT for why chunking exists at all:
// a single call asking the model to both read everything and write
// everything reliably times out once the input/expected-output grows large
// enough — a provider-agnostic risk, not specific to any one model.

// Token-based chunk budget (mirrors the ~4-chars/token heuristic used for
// input-token estimation throughout ai/). Env-configurable so a deployment
// can tune it without a code change; the default keeps a dense
// chapter-per-section summary comfortably under the chunk call's own output
// ceiling. Sized in TOKENS (not a flat char count) so a text-light-but-
// image-heavy source is judged by its real request cost, not just character
// count blind to what images actually add — see IMAGE_TOKEN_ESTIMATE below.
export const CHUNK_MAX_INPUT_TOKENS = Number(process.env.AI_CHUNK_MAX_TOKENS) || 4000;
export const CHARS_PER_TOKEN = 4;
export const CHUNK_MAX_CHARS = CHUNK_MAX_INPUT_TOKENS * CHARS_PER_TOKEN;

// Matches generateContent's own per-image token floor (see
// ai/generation/sectionGeneration.js's estimateTokens) — used here to fold
// a source's embedded images into its chunk-sizing budget.
export const IMAGE_TOKEN_ESTIMATE = 258;

// A chunk gets this many attempts and NEVER recursively splits on failure —
// a chunk that still fails after every attempt is far more likely hitting a
// real, non-transient problem (persistently malformed content, or the
// account being out of quota) than "too dense", and split-and-retry used to
// multiply one failing chunk into dozens of further calls for a single
// source. jsonrepair-based partial-response salvage already recovers most
// truncation cases without needing a retry at all, let alone a re-split.
export const MAX_CHUNK_ATTEMPTS = Number(process.env.AI_CHUNK_MAX_RETRIES) || 2;

// Recursive splitting is deliberately disabled (see MAX_CHUNK_ATTEMPTS
// above) — this is exposed as an explicit, documented 0 rather than left
// silently absent, so "configurable max split depth" is a real, honest knob
// instead of a missing feature. A future need for real recursive splitting
// would raise this value and add the recursion in generateChunkChapters.
export const AI_CHUNK_MAX_SPLIT_DEPTH = 0;

export const CHUNK_CONCURRENCY = 2;

// Splits `text` into pieces no larger than `maxChars`, breaking at
// paragraph boundaries where possible (never mid-sentence unless a single
// paragraph itself exceeds maxChars, in which case it's hard-split). A
// large single PDF/PPTX source is the exact case that still risks
// truncation under simple one-call-per-file chunking: a dense 100-slide
// deck can need 20-40 chapters on its own, which can exceed even a single
// chunk call's output ceiling. Proactively splitting the SOURCE TEXT before
// ever calling the model — rather than reactively detecting truncation
// after the fact — is what actually fixes that, not a bigger timeout.
export function splitTextIntoChunks(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = p;
    } else {
      current = candidate;
    }
    while (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
