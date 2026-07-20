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
import { renderLatexSegments, renderInline } from "./useLatex.js";

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

export function highlightCode(lang, code) {
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

// Callout box types the AI is instructed (see prompt/rules.js) to use for
// definition/concept/example/mistake/warning/tip/info asides, expressed as
// fenced code blocks with one of these as the "language" tag (e.g.
// ```tip ... ```) — a syntax models reliably produce, and one that degrades
// gracefully to a plain code block if a renderer that doesn't know about it
// ever sees it. Colors (applied in style.css) follow one consistent
// convention across the whole app: blue=definitions, green=concepts,
// cyan=examples, red=mistakes, orange=warnings, amber=tips, gray=info.
const CALLOUT_TYPES = {
  definition: { emoji: "📘", labelKey: "definition" },
  concept: { emoji: "💡", labelKey: "concept" },
  example: { emoji: "🧩", labelKey: "example" },
  mistake: { emoji: "❌", labelKey: "mistake" },
  warning: { emoji: "⚠️", labelKey: "warning" },
  tip: { emoji: "✨", labelKey: "tip" },
  info: { emoji: "ℹ️", labelKey: "info" },
};

function renderCallout(type, body) {
  const meta = CALLOUT_TYPES[type];
  const inlineBody = body
    .split(/\n{2,}/)
    .map((p) => `<p>${renderInline(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const label = meta.labelKey.charAt(0).toUpperCase() + meta.labelKey.slice(1);
  return `<div class="callout callout-${type}"><div class="callout-icon">${meta.emoji}</div><div class="callout-body"><span class="callout-label">${label}</span>${inlineBody}</div></div>`;
}

// GFM pipe tables aren't blank-line-delimited like other blocks (rows are
// single newlines apart), so they're pulled out in their own line-based
// pass before the blank-line split below — otherwise a table's rows fall
// through to the generic paragraph fallback as literal "| a | b |" text.
const TABLE_ROW_RE = /^\s*\|?(.+)\|?\s*$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderTable(headerLine, bodyLines) {
  const headers = splitTableRow(headerLine);
  const rows = bodyLines.map(splitTableRow);
  const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="rich-table-wrap"><table class="rich-table">${thead}${tbody}</table></div>`;
}

function extractTables(text, placeholders) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    const separator = lines[i + 1];
    if (header?.includes("|") && separator !== undefined && TABLE_SEPARATOR_RE.test(separator) && TABLE_ROW_RE.test(header)) {
      const body = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") {
        body.push(lines[j]);
        j++;
      }
      const token = "TABLEPLACEHOLDER" + placeholders.length;
      placeholders.push(renderTable(header, body));
      out.push(token);
      i = j;
    } else {
      out.push(header);
      i++;
    }
  }
  return out.join("\n");
}

/**
 * Rich block-level renderer: headings, GFM tables, callout boxes, code
 * fences, LaTeX, lists, and inline formatting. Used for long-form
 * generated content (chapter descriptions, worked solutions, full lecture
 * summaries) and chat replies.
 */
export function renderMarkdown(text, { copyLabel = "Copy" } = {}) {
  if (!text) return "";

  // Code fences (including callout fences) are pulled out as placeholder
  // tokens before the blank-line split below, since real code very often
  // contains blank lines itself — splitting first would slice a fenced
  // block into several "paragraphs" and run paragraph/list regexes over
  // its already-highlighted HTML.
  const codeBlocks = [];
  const withCodePlaceholders = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.trim();
    const token = "CODEBLOCKPLACEHOLDER" + codeBlocks.length;
    if (CALLOUT_TYPES[lang]) {
      codeBlocks.push(renderCallout(lang, trimmed));
    } else {
      const { html, lang: detected } = highlightCode(lang, trimmed);
      codeBlocks.push(
        `<div class="code-block"><div class="code-block-header"><span>${escapeHtml(detected || "text")}</span><button type="button" class="code-copy-btn">${escapeHtml(copyLabel)}</button></div><pre><code class="hljs">${html}</code></pre></div>`
      );
    }
    return token;
  });

  // Display math ($$...$$) gets the same placeholder protection — without
  // it, a formula the model split across a blank line for readability gets
  // cut into two separate "paragraphs" by the split below, each left with an
  // unbalanced $$ that renderLatexSegments can't recognize as math anymore.
  const mathBlocks = [];
  const withMathPlaceholders = withCodePlaceholders.replace(/\$\$[\s\S]+?\$\$/g, (fullMatch) => {
    const token = "MATHBLOCKPLACEHOLDER" + mathBlocks.length;
    mathBlocks.push(renderLatexSegments(fullMatch));
    return token;
  });

  const tablePlaceholders = [];
  const withPlaceholders = extractTables(withMathPlaceholders, tablePlaceholders);

  const blocks = withPlaceholders.split(/\n{2,}/).map((block) => {
    const trimmedBlock = block.trim();
    if (/^CODEBLOCKPLACEHOLDER\d+$/.test(trimmedBlock)) return trimmedBlock;
    if (/^MATHBLOCKPLACEHOLDER\d+$/.test(trimmedBlock)) return trimmedBlock;
    if (/^TABLEPLACEHOLDER\d+$/.test(trimmedBlock)) return trimmedBlock;

    const headingMatch = trimmedBlock.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch && !trimmedBlock.includes("\n")) {
      const level = Math.min(headingMatch[1].length + 3, 6); // ## -> h5, ### -> h6, capped
      return `<h${level} class="rich-heading">${renderInline(headingMatch[2])}</h${level}>`;
    }

    const lines = block.split("\n");
    const isBulletList = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

    if (isBulletList) {
      return `<ul>${lines.map((l) => `<li>${renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (isNumberedList) {
      return `<ol>${lines.map((l) => `<li>${renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }
    return `<p>${renderInline(block).replace(/\n/g, "<br>")}</p>`;
  });

  return blocks
    .join("")
    .replace(/CODEBLOCKPLACEHOLDER(\d+)/g, (_, i) => codeBlocks[Number(i)])
    .replace(/MATHBLOCKPLACEHOLDER(\d+)/g, (_, i) => mathBlocks[Number(i)])
    .replace(/TABLEPLACEHOLDER(\d+)/g, (_, i) => tablePlaceholders[Number(i)]);
}
