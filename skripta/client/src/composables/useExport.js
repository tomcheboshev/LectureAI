function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(title) {
  return (title || "study-package").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function toMarkdown(pkg, { watermark = false } = {}) {
  const lines = [];
  const m = pkg.metadata || {};
  lines.push(`# ${m.video_title || "Untitled lecture"}`, "");
  if (m.short_description) lines.push(m.short_description, "");
  lines.push(`_Subject: ${m.subject || "—"} · Level: ${m.estimated_level || "—"} · ~${m.estimated_duration_minutes || "?"} min_`, "");

  if (pkg.full_lecture_summary) {
    lines.push("## Summary", "", pkg.full_lecture_summary, "");
  }

  if (pkg.summary?.length) {
    lines.push("## Chapters", "");
    for (const c of pkg.summary) {
      lines.push(`### ${c.topic_title}`, "", c.description || "", "");
      for (const k of c.key_points || []) lines.push(`- ${k}`);
      lines.push("");
    }
  }

  if (pkg.core_concepts?.length) {
    lines.push("## Core Concepts", "");
    for (const c of pkg.core_concepts) {
      lines.push(`### ${c.term}`, "", c.definition || "", "", `**Why it matters:** ${c.why_it_matters || ""}`, "");
    }
  }

  if (pkg.glossary?.length) {
    lines.push("## Glossary", "");
    for (const g of pkg.glossary) lines.push(`- **${g.term}** — ${g.meaning}`);
    lines.push("");
  }

  if (pkg.quiz?.length) {
    lines.push("## Quiz", "");
    pkg.quiz.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
      for (const o of q.options || []) lines.push(`   - [${o === q.correctAnswer ? "x" : " "}] ${o}`);
      lines.push(`   _${q.explanation || ""}_`, "");
    });
  }

  if (pkg.flashcards?.length) {
    lines.push("## Flashcards", "");
    for (const f of pkg.flashcards) lines.push(`- **${f.front}** — ${f.back}`);
    lines.push("");
  }

  if (pkg.practice_tasks?.length) {
    lines.push("## Practice Tasks", "");
    for (const t of pkg.practice_tasks) {
      lines.push(`### (${t.difficulty}) ${t.task}`, "", `**Hint:** ${t.hint || ""}`, "", `**Solution:** ${t.solution || ""}`, "");
    }
  }

  if (pkg.true_false_questions?.length) {
    lines.push("## True / False", "");
    pkg.true_false_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.statement} — **${q.answer ? "True" : "False"}**`, `   _${q.explanation || ""}_`, "");
    });
  }

  if (pkg.short_answer_questions?.length) {
    lines.push("## Short Answer", "");
    pkg.short_answer_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`, "", `**Expected answer:** ${q.expected_answer || ""}`, "");
    });
  }

  if (pkg.learning_objectives?.length || pkg.prerequisites?.length || pkg.recommended_next_steps?.length) {
    lines.push("## Learning Path", "");
    if (pkg.learning_objectives?.length) {
      lines.push("### Learning Objectives", "");
      for (const o of pkg.learning_objectives) lines.push(`- ${o}`);
      lines.push("");
    }
    if (pkg.prerequisites?.length) {
      lines.push("### Prerequisites", "");
      for (const p of pkg.prerequisites) lines.push(`- ${p}`);
      lines.push("");
    }
    if (pkg.recommended_next_steps?.length) {
      lines.push("### Recommended Next Steps", "");
      for (const n of pkg.recommended_next_steps) lines.push(`- ${n}`);
      lines.push("");
    }
  }

  if (watermark) {
    lines.push("---", "", "_Generated with LectureAI (Free plan) — upgrade to Pro to export without this watermark._");
  }

  return lines.join("\n");
}

export function downloadMarkdown(pkg, { watermark = false } = {}) {
  download(`${slug(pkg.metadata?.video_title)}.md`, toMarkdown(pkg, { watermark }), "text/markdown");
}

export function downloadJson(pkg) {
  download(`${slug(pkg.metadata?.video_title)}.json`, JSON.stringify(pkg, null, 2), "application/json");
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function openPrintView(pkg, { watermark = false } = {}) {
  const m = pkg.metadata || {};
  const win = window.open("", "_blank");
  if (!win) return;

  const section = (title, html) => (html ? `<h2>${esc(title)}</h2>${html}` : "");

  const chapters = (pkg.summary || [])
    .map((c) => `<h3>${esc(c.topic_title)}</h3><p>${esc(c.description)}</p><ul>${(c.key_points || []).map((k) => `<li>${esc(k)}</li>`).join("")}</ul>`)
    .join("");

  const concepts = (pkg.core_concepts || [])
    .map((c) => `<h3>${esc(c.term)}</h3><p>${esc(c.definition)}</p><p><em>Why it matters: ${esc(c.why_it_matters)}</em></p>`)
    .join("");

  const glossary = (pkg.glossary || []).map((g) => `<li><strong>${esc(g.term)}</strong> — ${esc(g.meaning)}</li>`).join("");

  const quiz = (pkg.quiz || [])
    .map(
      (q, i) =>
        `<p><strong>${i + 1}. ${esc(q.question)}</strong></p><ul>${(q.options || [])
          .map((o) => `<li>${o === q.correctAnswer ? "✅" : "▫️"} ${esc(o)}</li>`)
          .join("")}</ul><p><em>${esc(q.explanation)}</em></p>`
    )
    .join("");

  const flashcards = (pkg.flashcards || []).map((f) => `<li><strong>${esc(f.front)}</strong> — ${esc(f.back)}</li>`).join("");

  const practiceTasks = (pkg.practice_tasks || [])
    .map((t) => `<h3>(${esc(t.difficulty)}) ${esc(t.task)}</h3><p><em>Hint: ${esc(t.hint)}</em></p><p><strong>Solution:</strong> ${esc(t.solution)}</p>`)
    .join("");

  const trueFalse = (pkg.true_false_questions || [])
    .map((q, i) => `<p><strong>${i + 1}. ${esc(q.statement)}</strong> — ${q.answer ? "True" : "False"}</p><p><em>${esc(q.explanation)}</em></p>`)
    .join("");

  const shortAnswer = (pkg.short_answer_questions || [])
    .map((q, i) => `<p><strong>${i + 1}. ${esc(q.question)}</strong></p><p><em>Expected answer: ${esc(q.expected_answer)}</em></p>`)
    .join("");

  const learningPath = [
    pkg.learning_objectives?.length ? `<h3>Learning Objectives</h3><ul>${pkg.learning_objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : "",
    pkg.prerequisites?.length ? `<h3>Prerequisites</h3><ul>${pkg.prerequisites.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : "",
    pkg.recommended_next_steps?.length ? `<h3>Recommended Next Steps</h3><ul>${pkg.recommended_next_steps.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "",
  ].join("");

  // Assigning `onload` before write()/close() (rather than after, as browsers
  // can fire `load` synchronously as part of close() in some engines, which
  // would silently drop a handler attached afterward) so the print dialog
  // reliably opens automatically.
  win.onload = () => win.print();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.video_title)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
      h1 { font-size: 28px; } h2 { font-size: 20px; margin-top: 36px; border-bottom: 2px solid #4F46E5; padding-bottom: 4px; }
      h3 { font-size: 16px; margin-bottom: 2px; }
      ul { padding-left: 20px; }
      .meta { color: #555; font-size: 14px; margin-bottom: 24px; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>${esc(m.video_title)}</h1>
    <p class="meta">${esc(m.subject)} · ${esc(m.estimated_level)} · ~${esc(m.estimated_duration_minutes)} min</p>
    <p>${esc(pkg.full_lecture_summary)}</p>
    ${section("Chapters", chapters)}
    ${section("Core Concepts", concepts)}
    ${glossary ? `<h2>Glossary</h2><ul>${glossary}</ul>` : ""}
    ${quiz ? `<h2>Quiz</h2>${quiz}` : ""}
    ${flashcards ? `<h2>Flashcards</h2><ul>${flashcards}</ul>` : ""}
    ${section("Practice Tasks", practiceTasks)}
    ${section("True / False", trueFalse)}
    ${section("Short Answer", shortAnswer)}
    ${learningPath ? `<h2>Learning Path</h2>${learningPath}` : ""}
    ${watermark ? `<p style="margin-top:40px;padding-top:12px;border-top:1px solid #ddd;color:#999;font-size:12px;">Generated with LectureAI (Free plan) — upgrade to Pro to export without this watermark.</p>` : ""}
    </body></html>`);
  win.document.close();
  win.focus();
}
