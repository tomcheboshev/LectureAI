import katex from "katex";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMath(expr, displayMode) {
  try {
    return katex.renderToString(expr, { throwOnError: false, displayMode, strict: "ignore" });
  } catch {
    return escapeHtml(expr);
  }
}

// Matches $$...$$ (block, tried first) or $...$ (inline) in one pass.
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * Scans RAW (unescaped) text once for $$...$$ / $...$ math segments,
 * escaping everything else and rendering matches with KaTeX. Doing this
 * in a single pass over the original text — rather than escaping first
 * and then running separate block/inline regex passes — is essential:
 * a second regex pass over text that already contains inserted KaTeX
 * HTML can match "$" characters *inside* that HTML (e.g. in a KaTeX
 * error message echoing the source) and mangle the markup.
 */
export function renderLatexSegments(rawText) {
  let out = "";
  let lastIndex = 0;
  for (const match of rawText.matchAll(MATH_PATTERN)) {
    out += escapeHtml(rawText.slice(lastIndex, match.index));
    const [full, block, inline] = match;
    out += block !== undefined ? renderMath(block.trim(), true) : renderMath(inline.trim(), false);
    lastIndex = match.index + full.length;
  }
  out += escapeHtml(rawText.slice(lastIndex));
  return out;
}

/**
 * Renders plain text that may contain LaTeX delimited by $$...$$ (block)
 * or $...$ (inline), escaping everything else. Safe for v-html: the only
 * unescaped HTML injected is KaTeX's own trusted output.
 */
export function renderLatexText(text) {
  if (!text) return "";
  return renderLatexSegments(String(text)).replace(/\n/g, "<br>");
}

/**
 * Wraps a formula string as block math, stripping any $ delimiters the
 * source may already include (the AI sometimes wraps formula fields in
 * $...$ itself despite the field being dedicated to the formula) so it's
 * never double-wrapped into "$$$...$$$".
 */
export function renderBlockFormula(formula) {
  const trimmed = String(formula || "").trim().replace(/^\${1,2}/, "").replace(/\${1,2}$/, "");
  return renderMath(trimmed, true);
}
