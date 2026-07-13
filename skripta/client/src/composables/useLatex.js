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

// Matches $$...$$ (block, tried first) or $...$ (inline) in one pass, using
// Pandoc's own tex_math_dollars rules: the opening $ must not be immediately
// followed by whitespace, the closing $ must not be immediately preceded by
// whitespace, and the closing $ must not be immediately followed by a digit.
//
// A digit is explicitly allowed right after the *opening* $ — math in this
// app's content constantly starts with a bare numeral ("$2 \cdot 0.62 =
// 1.24$", "$0.5 \cdot 2 = 1.0$"), so excluding that case (an earlier version
// of this regex did) silently left the majority of worked-example formulas
// as unrendered literal text. The original motivating bug — prose like
// "costs $500 and the CPU costs $300" spanning from the first $ to the
// second and leaving "300" orphaned — is already prevented by the
// closing-side whitespace guard alone: the character right before the
// second $ (a space, from "costs $300") fails `(?<!\s)`, so neither $ ever
// matches as math and both are left as plain text. The trailing
// not-followed-by-digit guard on the close additionally guards against a
// pathological "$5$10" back-to-back case.
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g;

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

// Inline formatting shared by every renderer in this app: LaTeX first (via
// renderLatexSegments, which does its own HTML-escaping of everything that
// isn't math) so **bold** markers inside a $...$ span are never misread as
// literal asterisks, then bold/italic/inline-code on top of the result.
// Lives here (not in useMarkdown.js) so useMarkdown.js can import it
// without a circular dependency, since it already imports
// renderLatexSegments from this module.
export function renderInline(text) {
  return renderLatexSegments(String(text ?? ""))
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

/**
 * Renders plain text that may contain LaTeX ($$...$$/$...$) plus inline
 * markdown (**bold**, *italic*, `code`), escaping everything else. Safe for
 * v-html: the only unescaped HTML injected is KaTeX's own trusted output
 * plus the handful of inline tags this function itself adds. No block-level
 * treatment (no headings/lists/tables) — for long-form content that needs
 * that, use renderMarkdown from useMarkdown.js instead.
 */
export function renderLatexText(text) {
  if (!text) return "";
  return renderInline(text).replace(/\n/g, "<br>");
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
