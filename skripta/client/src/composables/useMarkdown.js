function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Minimal, dependency-free markdown renderer for chat replies.
 * Escapes HTML first, then applies a small safe subset of markdown
 * (bold, italic, inline/block code, bullet & numbered lists, paragraphs).
 */
export function renderMarkdown(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);

  const withCodeBlocks = escaped.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);

  const blocks = withCodeBlocks.split(/\n{2,}/).map((block) => {
    if (block.startsWith("<pre>")) return block;

    const lines = block.split("\n");
    const isBulletList = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

    const inline = (s) =>
      s
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

    if (isBulletList) {
      return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (isNumberedList) {
      return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }
    return `<p>${inline(block).replace(/\n/g, "<br>")}</p>`;
  });

  return blocks.join("");
}
