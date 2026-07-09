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

/**
 * Replaces $$...$$ (block) and $...$ (inline) LaTeX delimiters in
 * already-escaped HTML with KaTeX's rendered output. Reused by the chat
 * markdown renderer so formulas render there too.
 */
export function injectLatex(escapedHtml) {
  const withBlocks = escapedHtml.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => renderMath(expr.trim(), true));
  return withBlocks.replace(/\$([^$\n]+?)\$/g, (_, expr) => renderMath(expr.trim(), false));
}

/**
 * Renders plain text that may contain LaTeX delimited by $$...$$ (block)
 * or $...$ (inline), escaping everything else. Safe for v-html: the only
 * unescaped HTML injected is KaTeX's own trusted output.
 */
export function renderLatexText(text) {
  if (!text) return "";
  const escaped = escapeHtml(String(text));
  return injectLatex(escaped).replace(/\n/g, "<br>");
}
