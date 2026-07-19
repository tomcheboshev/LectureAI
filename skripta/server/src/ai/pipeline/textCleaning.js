// Local, non-AI normalization run right after extraction — the pipeline's
// "Clean Text" stage. Extracted text (especially from PDFs) commonly
// carries control characters, line-wrap hyphenation, and inconsistent
// whitespace that add noise (and tokens) to every downstream prompt without
// adding any information — cheaper and more reliable to strip once here
// than to ask the model to mentally filter it out on every call.

// Matches the null byte plus every other C0 control character except tab
// (0x09) and newline (0x0A), which are meaningful whitespace we keep.
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export function cleanExtractedText(text) {
  if (!text) return "";
  return text
    .replace(CONTROL_CHARS_RE, "")
    .replace(/-\n(?=[a-z])/g, "") // de-hyphenate line-wrap artifacts: "algo-" + newline + "rithm" -> "algorithm" (only merges when the next line continues in lowercase, so a real hyphenated compound broken at a line end isn't merged incorrectly)
    .replace(/[ \t]+\n/g, "\n") // trailing whitespace before a newline
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ consecutive blank lines to one
    .replace(/[ \t]{2,}/g, " ") // collapse repeated spaces/tabs
    .trim();
}
