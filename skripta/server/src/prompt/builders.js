// ============================================================================
// SECTION: PROMPT BUILDER
// Composes the section constants from counts/rules/examples/schema into the
// actual prompts sent to the AI provider. Each system prompt includes only
// the sections relevant to what it generates — see the inline comment on
// each for why.
// ============================================================================

import { suggestedCounts, targetCountsBlock } from "./counts.js";
import {
  AI_ROLE,
  SUMMARY_RULES,
  STUDY_NOTES_RULES,
  CORE_CONCEPTS_RULES,
  QUIZ_RULES,
  FLASHCARDS_RULES,
  FORMULA_RULES,
  DIAGRAM_RULES,
  LATEX_RULES,
  MARKDOWN_RULES,
  IMAGE_RULES,
  LATEX_RULES_COMPACT,
  MARKDOWN_RULES_COMPACT,
  IMAGE_RULES_COMPACT,
  ACTIVE_LEARNING_RULE,
  DEEP_COMPREHENSION_RULE,
  CHAPTER_LENGTH_RULE,
  CONTENT_LENGTH_RULE,
  FIDELITY_AUDIT_RULE,
  NO_REPETITION_RULE,
  STYLE_VARIETY_RULE,
  VALIDATION_RULES,
  OUTPUT_REQUIREMENTS,
} from "./rules.js";
import {
  CHAPTER_WORKED_EXAMPLE,
  QUIZ_WORKED_EXAMPLE,
  FLASHCARD_WORKED_EXAMPLE,
  PRACTICE_TASK_WORKED_EXAMPLE,
} from "./examples.js";
import { FULL_JSON_STRUCTURE, CHUNK_JSON_STRUCTURE, SYNTHESIS_JSON_STRUCTURE } from "./schema.js";

// --- Full single-call path (small/typical inputs: model reads everything
// and writes everything in one request) --------------------------------

export const SYSTEM_PROMPT = [
  AI_ROLE,
  "Your goal is to transform a raw lecture transcript or presentation slides into a comprehensive, high-fidelity, interactive study package. This package will power a modern student web application, requiring rigorous technical accuracy, pedagogical scaffolding, and perfectly valid JSON formatting.",
  SUMMARY_RULES,
  `### RULES\n1. ${ACTIVE_LEARNING_RULE}\n2. ${DEEP_COMPREHENSION_RULE}\n3. ${CHAPTER_LENGTH_RULE}\n4. ${CONTENT_LENGTH_RULE}\n5. ${FIDELITY_AUDIT_RULE}\n6. ${NO_REPETITION_RULE}\n7. ${STYLE_VARIETY_RULE}`,
  STUDY_NOTES_RULES,
  CORE_CONCEPTS_RULES,
  QUIZ_RULES,
  FLASHCARDS_RULES,
  FORMULA_RULES,
  DIAGRAM_RULES,
  LATEX_RULES,
  IMAGE_RULES,
  MARKDOWN_RULES,
  VALIDATION_RULES,
  `### WORKED EXAMPLES (illustrate the required depth and tone — do not reuse this content; every example below is about an unrelated topic and exists only to calibrate quality)\n\n${CHAPTER_WORKED_EXAMPLE}\n\n${QUIZ_WORKED_EXAMPLE}\n\n${FLASHCARD_WORKED_EXAMPLE}\n\n${PRACTICE_TASK_WORKED_EXAMPLE}`,
  `### REQUIRED JSON STRUCTURE\n\n${FULL_JSON_STRUCTURE}`,
  OUTPUT_REQUIREMENTS,
].join("\n\n---\n\n");

// Lists the images extracted from the source file(s) and attached as inline
// multimodal data alongside this prompt, so the model can reference them by
// id in "summary[].images" instead of guessing at what was sent. Returns ""
// when there are no images, so callers can splice it in unconditionally.
function buildImageManifest(images) {
  if (!images?.length) return "";
  const lines = images.map((img) => `- ${img.id}: from source ${img.sourceIndex}${img.label ? ` (${img.label})` : ""}`).join("\n");
  return `\n\nAVAILABLE IMAGES (attached below as inline image data, in this order):\n${lines}\n`;
}

export function buildUserMessage({ video_title, subject, difficulty, transcript, images }) {
  return `INPUT DATA FOR THE STUDY PACKAGE:
  Lecture Title: ${video_title || "Untitled Lecture"}
  Subject/Course: ${subject || "General Academic"}
  Difficulty Preference: ${difficulty || "auto"}

  ${targetCountsBlock(suggestedCounts(transcript.length))}
  ${buildImageManifest(images)}
  RAW TRANSCRIPT TO ANALYZE:
  ${transcript}`;
}

// --- Chunked generation (large multi-file / large single-file inputs) ----
//
// A single call asking the model to both READ everything (the full raw
// transcript, potentially hundreds of KB across many source files) and
// WRITE everything (summary chapters PLUS quiz/flashcards/practice/notes/
// glossary/etc.) reliably times out once the input/expected-output grows
// large enough — a direct consequence of how much one request asks the
// model to read and produce, not a fluke. This splits into small calls (one
// per source, or several per source once the source itself is large) each
// producing only summary chapters, plus one final synthesis call
// (everything else, working from the now-compact merged summary instead of
// raw transcripts) — every individual call's input and output stays
// bounded regardless of how many files or how large the material is.

const SUMMARY_CHUNK_SYSTEM_PROMPT = [
  AI_ROLE,
  `You are given ONE source document (one file out of a larger multi-file upload, or one section of a larger document). Your ONLY job on this call is to produce exhaustive, textbook-quality "summary" chapters for THIS source — nothing else. A separate, later call handles quiz/flashcards/practice tasks/glossary/etc. for the whole course, so do not attempt those here.`,
  SUMMARY_RULES,
  `### RULES\n1. ${CHAPTER_LENGTH_RULE}\n2. ${FIDELITY_AUDIT_RULE}\n3. ${STYLE_VARIETY_RULE}`,
  FORMULA_RULES,
  DIAGRAM_RULES,
  LATEX_RULES_COMPACT,
  IMAGE_RULES_COMPACT,
  MARKDOWN_RULES_COMPACT,
  `### WORKED EXAMPLE (this is the depth bar for every chapter)\n\n${CHAPTER_WORKED_EXAMPLE}`,
  `### REQUIRED JSON STRUCTURE\n\n${CHUNK_JSON_STRUCTURE}`,
  OUTPUT_REQUIREMENTS,
].join("\n\n---\n\n");

function buildImageManifestChunk(images) {
  if (!images?.length) return "";
  const lines = images.map((img) => `- ${img.id}${img.label ? ` (${img.label})` : ""}`).join("\n");
  return `\n\nAVAILABLE IMAGES (attached below as inline image data, in this order):\n${lines}\n`;
}

export function buildSummaryChunkSystemPrompt() {
  return SUMMARY_CHUNK_SYSTEM_PROMPT;
}

export function buildSummaryChunkUserMessage({ video_title, subject, source, images }) {
  return `INPUT DATA:
  Lecture/Course Title: ${video_title || "Untitled Lecture"}
  Subject/Course: ${subject || "General Academic"}
  This source's filename: ${source.filename}
  ${buildImageManifestChunk(images)}
  SOURCE DOCUMENT TO ANALYZE:
  ${source.extracted_text}`;
}

const SYNTHESIS_SYSTEM_PROMPT = [
  AI_ROLE,
  `You are given a DISTILLED SUMMARY of a full course/lecture — already-written, textbook-quality chapter notes covering every topic in the material (produced by an earlier pass). Your job is to synthesize this into the remaining parts of a study package: metadata, core concepts, study notes, quiz, flashcards, practice tasks, true/false, short answer, glossary, learning path, and chatbot grounding context. Treat the distilled summary below as your authoritative source material — it already contains the extracted problems, formulas, and worked examples you need.`,
  `### RULES\n1. ${DEEP_COMPREHENSION_RULE}\n2. ${CONTENT_LENGTH_RULE}\n3. ${NO_REPETITION_RULE}`,
  STUDY_NOTES_RULES,
  CORE_CONCEPTS_RULES,
  QUIZ_RULES,
  FLASHCARDS_RULES,
  FORMULA_RULES,
  LATEX_RULES_COMPACT,
  MARKDOWN_RULES_COMPACT,
  VALIDATION_RULES,
  `### WORKED EXAMPLES (calibrate quality — do not reuse this content, it is about an unrelated topic)\n\n${QUIZ_WORKED_EXAMPLE}\n\n${FLASHCARD_WORKED_EXAMPLE}\n\n${PRACTICE_TASK_WORKED_EXAMPLE}`,
  `### REQUIRED JSON STRUCTURE\n\n${SYNTHESIS_JSON_STRUCTURE}`,
  OUTPUT_REQUIREMENTS,
].join("\n\n---\n\n");

export function buildSynthesisSystemPrompt() {
  return SYNTHESIS_SYSTEM_PROMPT;
}

// The distilled summary text fed to the synthesis call — chapter titles +
// descriptions + key points from every chunk, which already carries the
// extracted problems/formulas/examples the synthesis prompt draws on. Not
// the full chapter JSON (formulas/algorithms/diagrams/code arrays are
// substantial and mostly redundant with what description already covers in
// prose) — keeping this compact is the entire point of the chunked
// pipeline's second call staying fast.
export function buildDistilledSummaryText(summaryChapters) {
  return summaryChapters
    .map((c) => {
      const label = c.source_title ? `[${c.source_title}] ` : "";
      const keyPoints = (c.key_points || []).map((k) => `- ${k}`).join("\n");
      return `### ${label}${c.topic_title}\n${c.description}${keyPoints ? `\n${keyPoints}` : ""}`;
    })
    .join("\n\n");
}

export function buildSynthesisUserMessage({ video_title, subject, difficulty, distilledSummary, counts }) {
  return `INPUT DATA FOR THE STUDY PACKAGE:
  Lecture Title: ${video_title || "Untitled Lecture"}
  Subject/Course: ${subject || "General Academic"}
  Difficulty Preference: ${difficulty || "auto"}

  ${targetCountsBlock(counts)}

  DISTILLED COURSE SUMMARY (already-written chapter notes covering the whole course — your source material):
  ${distilledSummary}`;
}

// --- Multi-source input --------------------------------------------------

export const MULTI_SOURCE_INSTRUCTIONS = `
MULTI-SOURCE INPUT:
Multiple source documents were provided below, each marked "=== SOURCE N: filename ===" and given in upload order. Treat them as one course, with these rules:

* "summary": process sources in the given order. Tag every chapter with "source_index" (0-based, matching the source order) and "source_title" (the source's meaningful title if it clearly has one, e.g. a slide deck's title slide or a document's heading; otherwise use the source's original filename shown in its "=== SOURCE N: filename ===" marker, without the file extension). Do NOT merge chapters from different sources into one entry — each chapter belongs to exactly one source.
* Every other section — core_concepts, study_notes, quiz, flashcards, practice_tasks, true_false_questions, short_answer_questions, glossary, learning_objectives, prerequisites, recommended_next_steps, chatbot_context — must synthesize information across ALL sources combined as a single course. Do not duplicate a concept/definition/formula that appears in more than one source; merge them into one entry and, if the sources present it differently, reconcile the explanation.
* Preserve the logical learning order across sources when it affects sequencing (e.g. prerequisites named in an earlier source shouldn't be re-derived from a later one).`;

// --- Per-section regeneration -------------------------------------------

export const REGENERATABLE_SECTIONS = {
  summary: {
    key: "summary",
    instructions: `Regenerate the summary section using textbook-quality pedagogical scaffolding (Intuition -> Mechanics -> Edge Cases). Extract and completely solve every mathematical problem, slide example, or algorithmic trace present in the transcript. For automata/state machines, include a markdown table and valid Mermaid.js diagram syntax. Use double-escaped LaTeX (\\\\ commands).`,
  },
  core_concepts: {
    key: "core_concepts",
    instructions: `Regenerate the core concepts — a quick review of the lecture's most essential ideas, focusing on how they act as foundational rules for problem-solving. Return JSON with key "core_concepts".`,
  },
  study_notes: {
    key: "study_notes",
    instructions: `Regenerate the study notes. Return JSON with key "study_notes". Highlight common procedural missteps and exam-heavy problem archetypes.`,
  },
  quiz: {
    key: "quiz",
    instructions: (counts) =>
      `Regenerate the quiz array to contain exactly ${counts.quiz} multiple-choice questions. Ensure a solid portion of the quiz tests mathematical, technical, or state diagram evaluation rather than just vocab matching. Provide clear explanations.`,
  },
  flashcards: {
    key: "flashcards",
    instructions: (counts) =>
      `Regenerate exactly ${counts.flashcards} active-recall flashcards. Include procedural flashcards and state/transition queries to reinforce problem-solving.`,
  },
  practice_tasks: {
    key: "practice_tasks",
    instructions: (counts) =>
      `Regenerate exactly ${counts.practice} practice tasks. These must be direct computational, analytical, or algorithmic challenges taken or heavily inspired by the tasks in the material, with complete execution traces and structural/Mermaid solutions where applicable.`,
  },
  edge_cases_and_limits: {
    key: "edge_cases_and_limits",
    instructions: `Regenerate the edge_cases_and_limits section. Focus on parameters, stack limits (PDA), or string inputs that break formulas or automata provided in the practical tasks.`,
  },
  true_false_questions: {
    key: "true_false_questions",
    instructions: (counts) =>
      `Regenerate the true/false questions. Generate ${counts.trueFalse} items targeting common traps students fall into while setting up calculations or execution steps.`,
  },
  short_answer_questions: {
    key: "short_answer_questions",
    instructions: (counts) =>
      `Regenerate the short-answer questions. Generate ${counts.shortAnswer} items requiring students to mathematically or structurally justify a state machine or solution path.`,
  },
  glossary: {
    key: "glossary",
    instructions: (counts) =>
      `Regenerate the glossary. Return JSON with key "glossary" containing up to ${counts.glossary} operational terms.`,
  },
};

export function buildRegenerateSystemPrompt(section, counts, isMultiSource = false) {
  const spec = REGENERATABLE_SECTIONS[section];
  const instructions = typeof spec.instructions === "function" ? spec.instructions(counts) : spec.instructions;
  // Regeneration re-sends the full transcript, which for a multi-source
  // package still contains the "=== SOURCE N: filename ===" markers — without
  // repeating the multi-source contract here, the model has no instructions
  // for those markers and (for "summary" especially) drops the
  // source_index/source_title tagging the rest of the document relies on.
  const multiSourceBlock = isMultiSource ? `\n${MULTI_SOURCE_INSTRUCTIONS}\n` : "";
  return `You are an elite Educational Technology AI agent. Regenerate the single requested JSON property section based on the following specific instructions:

${instructions}
${multiSourceBlock}
STRICT OUTPUT FORMAT: the very first character of your response must be \`{\` and the very last must be \`}\`. Return ONLY the raw JSON object containing exactly the top-level key: "${spec.key}". No "Here is..." preface, no explanations, no markdown blocks, no formatting anomalies. Double escape all LaTeX backslashes (\`\\\\\`).`;
}

export function buildRegenerateUserMessage({ video_title, subject, transcript }) {
  return `Lecture Title: ${video_title || "Untitled Lecture"}
Subject/Course: ${subject || "General Academic"}

RAW TRANSCRIPT:
${transcript}`;
}

// --- Per-concept AI actions (The Real-Time AI Tutor Layer) ----------------

export const EXPLAIN_ACTIONS = {
  simpler: "Deconstruct this concept to its absolute fundamental mechanism. Use a plain-language explanation that bypasses heavy jargon while retaining technical accuracy.",
  detail: "Provide an advanced graduate-level granular breakdown of this concept. Include underlying architectural/mathematical nuances, invariant properties, and edge-case exceptions.",
  example: "Formulate a concrete, end-to-end trace or real-world industrial/academic example where this concept is explicitly executed or computed.",
  compare: "Construct a high-contrast analytical juxtaposition with the related concept. Detail shared abstractions, fundamental operational differences, and specific scenarios where one dominates over the other.",
  practice: "Design an elegant mini-diagnostic check (1 multi-step question + itemized interactive solution) specifically tailored to expose bugs in a student's mental model of this concept.",
  analogy: "Create a vivid, mathematically isomorphic physical or situational analogy that translates the abstract structural mechanics of this concept into highly intuitive spatial or everyday systems.",
  eli10: "Explain this using extreme cognitive scaffolding fit for a 10-year-old. Rely on simple verbs, zero jargon, and high-imagery narrative styling, without losing the logical core of the concept.",
  socratic: "Do NOT give the answer directly. Instead, ask the student 1-2 guiding, analytical questions based on their query to lead them to discover the answer themselves. Provide a subtle hint embedded in the context.",
  bug_hunt: "Generate a broken code snippet, a flawed mathematical proof, or an incorrect logical derivation based on this concept. Challenge the student to locate the 'bug' and explain why it violates academic rules.",
  reframe: "Explain this concept from a completely different domain's perspective (e.g., explain a PDA stack using a pile of cafeteria plates, or a Turing Machine tape using a film reel projector)."
};

export function buildExplainPrompt({ lectureTitle, lectureSummary, term, definition, action, compareWith }) {
  const instruction = EXPLAIN_ACTIONS[action];
  return `You are an elite personal AI Tutor facilitating an interactive learning session for a student studying "${lectureTitle}".

[CONTEXT]
Lecture Summary: ${lectureSummary || "N/A"}
Target Term: "${term}"
Current Working Base: "${definition || "N/A"}"
${compareWith ? `Juxtaposition Component: "${compareWith}"` : ""}

[TASK]
${instruction}

[PEDAGOGICAL ARCHITECTURE]
* Answer in 3 to 6 high-impact sentences (or a short interactive question/code trace structure if performing a bug_hunt or practice check).
* Avoid lazy intros like "Sure, here is...". Dive straight into the core value.
* If rendering formulas, state diagrams, or structural symbols, use LaTeX ($inline$ or $$display$$) or Mermaid code strings where appropriate. Keep formatting strictly plain-text without markdown headers (\`#\`).`;
}

// --- AI Tutor chat (grounded Q&A over the generated package) --------------

// Grounds the tutor in the FULL chatbot_context plus core_concepts/glossary,
// with the same pedagogical rigor and length discipline as the rest of the
// prompt suite.
export function buildChatSystemPrompt(pkgDoc) {
  const ctx = pkgDoc.chatbot_context || {};
  const glossaryTerms = (pkgDoc.glossary || []).map((g) => g.term).filter(Boolean);
  const conceptTerms = (pkgDoc.core_concepts || []).map((c) => c.term).filter(Boolean);

  return `You are an elite personal AI Tutor for a student studying "${pkgDoc.metadata?.video_title || "this lecture"}" (${pkgDoc.metadata?.subject || "General"}).

[GROUNDING — the only material you may draw on]
Full summary: ${pkgDoc.full_lecture_summary || "N/A"}
Lecture overview: ${ctx.lecture_overview || "N/A"}
Key takeaways: ${(ctx.key_takeaways || []).join("; ") || "N/A"}
Important terms: ${(ctx.important_terms || []).join(", ") || glossaryTerms.join(", ") || "N/A"}
Core concepts covered: ${conceptTerms.join(", ") || "N/A"}
Rules/formulas/methods: ${(ctx.rules_formulas_or_methods || []).join("; ") || "N/A"}
Common student confusion points: ${(ctx.student_confusion_points || []).join("; ") || "N/A"}

[BEHAVIOR RULES]
1. Answer ONLY questions about this lecture's material. If asked something unrelated or outside this grounding, briefly say it's outside this lecture's scope and redirect to what the package does cover — never fabricate content beyond the grounding above.
2. Be concise by default: 2-5 sentences for a direct question. Only give a longer, structured answer when the student explicitly asks for more detail, a full derivation, or a step-by-step walkthrough.
3. When a question touches a known student confusion point, address it explicitly rather than glossing over it.
4. Formatting: use LaTeX ($inline$ or $$display$$, never \\(...\\) or \\[...\\]) for math, and Markdown (backticks for code, **bold** for emphasis, numbered lists for steps) — the frontend renders both. Do not wrap plain prose in a markdown header.
5. No lazy filler ("Great question!", "Sure, here is..."). Start directly with the substance.`;
}
