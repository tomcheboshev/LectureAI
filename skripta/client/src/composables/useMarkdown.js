// The full "highlight.js" package registers ~190 languages out of the box,
// which alone added ~1MB to the bundle. Use the core build and register
// only the languages realistically seen in study-package chat/code content.
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import php from "highlight.js/lib/languages/php";
import ruby from "highlight.js/lib/languages/ruby";
import plaintext from "highlight.js/lib/languages/plaintext";
import { renderLatexSegments } from "./useLatex.js";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("php", php);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("plaintext", plaintext);

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightCode(lang, code) {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return { html: hljs.highlight(code, { language: lang }).value, lang };
    }
    const auto = hljs.highlightAuto(code);
    return { html: auto.value, lang: auto.language || "" };
  } catch {
    return { html: escapeHtml(code), lang: lang || "" };
  }
}

/**
 * Minimal, dependency-free markdown renderer for chat replies.
 * Escaping happens per-segment (via renderLatexSegments, which also
 * handles LaTeX) rather than once up front, so math delimiters are
 * always matched against the original raw text.
 */
export function renderMarkdown(text, { copyLabel = "Copy" } = {}) {
  if (!text) return "";

  // Code fences are pulled out as placeholder tokens before the blank-line
  // split below, since real code very often contains blank lines itself —
  // splitting first would slice a fenced block into several "paragraphs"
  // and run paragraph/list regexes over its already-highlighted HTML.
  const codeBlocks = [];
  const withCodePlaceholders = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.trim();
    const { html, lang: detected } = highlightCode(lang, trimmed);
    const token = "CODEBLOCKPLACEHOLDER" + codeBlocks.length;
    codeBlocks.push(
      `<div class="code-block"><div class="code-block-header"><span>${escapeHtml(detected || "text")}</span><button type="button" class="code-copy-btn">${escapeHtml(copyLabel)}</button></div><pre><code class="hljs">${html}</code></pre></div>`
    );
    return token;
  });

  // Display math ($$...$$) gets the same placeholder protection — without
  // it, a formula the model split across a blank line for readability gets
  // cut into two separate "paragraphs" by the split below, each left with an
  // unbalanced $$ that renderLatexSegments can't recognize as math anymore.
  const mathBlocks = [];
  const withPlaceholders = withCodePlaceholders.replace(/\$\$[\s\S]+?\$\$/g, (fullMatch) => {
    const token = "MATHBLOCKPLACEHOLDER" + mathBlocks.length;
    mathBlocks.push(renderLatexSegments(fullMatch));
    return token;
  });

  const blocks = withPlaceholders.split(/\n{2,}/).map((block) => {
    const trimmedBlock = block.trim();
    if (/^CODEBLOCKPLACEHOLDER\d+$/.test(trimmedBlock)) return trimmedBlock;
    if (/^MATHBLOCKPLACEHOLDER\d+$/.test(trimmedBlock)) return trimmedBlock;

    const lines = block.split("\n");
    const isBulletList = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

    const inline = (s) =>
      renderLatexSegments(s)
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

  return blocks
    .join("")
    .replace(/CODEBLOCKPLACEHOLDER(\d+)/g, (_, i) => codeBlocks[Number(i)])
    .replace(/MATHBLOCKPLACEHOLDER(\d+)/g, (_, i) => mathBlocks[Number(i)]);
}
