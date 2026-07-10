// mermaid is a large dependency (its diagram-type renderers alone add
// hundreds of KB) — loaded lazily so a study package with zero diagrams
// never pays for it, instead of bundling it directly into every visit to
// StudyPackagePage.
let mermaidPromise = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      return mermaid;
    });
  }
  return mermaidPromise;
}

let renderSeq = 0;

// Renders one Mermaid diagram to an SVG string. Each call gets a unique id
// (mermaid's own render() requires one and reuses stale DOM state otherwise)
export async function renderMermaidToSvg(code) {
  const mermaid = await loadMermaid();
  const id = `mermaid-${Date.now()}-${renderSeq++}`;
  const { svg } = await mermaid.render(id, code.trim());
  return svg;
}

// Splits raw text into alternating plain-text and ```mermaid fenced-code
// segments, so a caller can render each with the appropriate renderer. The
// backend prompt asks for Mermaid diagrams embedded inside otherwise-plain
// description strings (diagrams_or_tables_explained, practice task
// solutions) — before this, those fences were only ever shown as raw text.
export function splitMermaidSegments(text) {
  const segments = [];
  const pattern = /```mermaid\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  for (const match of String(text || "").matchAll(pattern)) {
    if (match.index > lastIndex) segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    segments.push({ type: "mermaid", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: "text", content: text.slice(lastIndex) });
  return segments;
}
