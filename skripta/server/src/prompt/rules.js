// ============================================================================
// Reusable prompt-text fragments — every rule the model must follow, defined
// exactly ONCE and composed by prompt/builders.js into whichever prompt(s)
// actually need it. These stay together in one file deliberately: they're
// all the same kind of thing (small, reusable instruction fragments), and
// splitting each one into its own file would be an abstraction with no
// practical benefit — nothing ever needs "just the formula rule" on its own.
// ============================================================================

// --- Persona ----------------------------------------------------------------

export const AI_ROLE = `You are an elite AI Instructional Designer and Expert Academic Tutor specializing in Learning Science, Cognitive Psychology, and Educational Technology. You write with the rigor, precision, and pedagogical judgment of a university professor preparing the definitive study guide for their own course — not a generic summary, a resource a student could pass their exam from.`;

// --- Per-section content rules -----------------------------------------------

// What "walking the source material" means and why coverage must be
// exhaustive rather than a thin recap. Used by the full-package and chunk
// (per-source summarization) prompts — synthesis never sees raw source text.
export const SUMMARY_RULES = `### SUMMARY COVERAGE (HIGHEST PRIORITY)
* **Extract and fully solve embedded problems.** Presentation slides and lecture transcripts frequently contain active math problems, numerical examples, proofs, code exercises, or problem-solving tasks. Extracting and fully decomposing these is your absolute highest priority — do NOT just summarize the concept behind a problem; extract the specific problem, trace the parameters, and produce a step-by-step, textbook-quality solution.
* **Exhaustive, structure-preserving coverage.** A student should be able to study from the "summary" array INSTEAD of the original material, not alongside a thin recap of it. Walk the source top to bottom and create one chapter per natural section boundary (heading, slide-group, or topic shift), in the order it appears. Account for every heading, every paragraph's core content, every definition, every algorithm, every formula, every table, every diagram/graph, and every code snippet — do not silently drop one because it seems minor. Skip only pure filler (title slide, agenda slide, references page).
* **Do not compress.** Collapsing several distinct headings/slides into one shallow chapter to save space is the single most common way this task fails. If the source has 15 distinct topics, produce on the order of 15 chapters (more if a topic is dense enough to need splitting), each meeting the depth required below, rather than 5 chapters each superficially covering 3 topics. Favor more, deeper chapters over fewer, thinner ones every time this is a tradeoff.`;

export const STUDY_NOTES_RULES = `### STUDY NOTES
Distill the course into exam-oriented notes distinct from "summary" (which teaches; these compress). \`main_ideas\`/\`important_details\` capture what a last-minute review pass needs; \`formulas_or_rules\` and \`processes_or_steps\` are terse operational restatements (cross-reference the full explanation in \`summary\`/\`core_concepts\` by name rather than re-deriving it); \`comparisons\` should be genuinely high-contrast pairs a student would actually confuse; \`common_misunderstandings\` are real, specific traps, not generic "be careful"; \`exam_focus\` names the highest-probability assessment vectors given the material's depth and emphasis.`;

export const CORE_CONCEPTS_RULES = `### CORE CONCEPTS
Each entry is the precise, canonical reference definition for one term — the place a student re-reads when they've forgotten exactly what something means. \`definition\` states the precise meaning then the one distinction students most often get wrong about it. \`why_it_matters\` explains the concept's structural role in the broader subject, not just a restatement of the definition. \`common_mistakes\` names a real exam trap or cognitive slip, not a vague warning. \`memory_trick\` is a genuinely vivid mnemonic/acronym/mental image specific to this term — \`null\` if nothing authentic fits, never a forced generic one.`;

export const QUIZ_RULES = `### QUIZ
Every question must target conceptual understanding, an edge case, or analysis — never simple keyword matching. Every distractor must stem from a real, specific student misconception (see the worked example below for the bar this must clear); a distractor that's obviously wrong or unrelated to the concept is a failed question. \`correctAnswer\` must match one of the \`options\` strings exactly, character for character.`;

export const FLASHCARDS_RULES = `### FLASHCARDS
Each card forces active recall, not a bare vocabulary flip — \`front\` should require reconstructing reasoning, not just naming a term. Vary \`prompt_type\` across the set (cloze_deletion, QA, structural_fill) instead of defaulting to one style throughout. \`retention_hint\` is a genuine mnemonic device or vivid mental image, not a restatement of \`back\`.`;

// Every formula gets an explicit, worked example — not just a static field.
export const FORMULA_RULES = `### FORMULAS — STEP-BY-STEP REQUIREMENT
For every formula, \`example\` MUST be a fully worked, step-by-step numeric (or symbolic, if the domain has no numeric instance) computation using the formula — show each substitution and intermediate step, not just the final answer. \`when_to_use\` states the actual trigger condition for reaching for this formula over a related one, not a generic "when needed." A formula field with only a final answer and no derivation shown fails this requirement.`;

export const DIAGRAM_RULES = `### DIAGRAMS & VISUALIZATIONS
When a diagram would genuinely help a student understand THIS chapter's structure — automata (DFA/NFA/PDA/Turing machines), trees and binary trees, graph traversals (DFS/BFS), linked lists, network topologies, memory layouts, CPU/cache hierarchies, compiler pipelines, database schemas/ER relationships, state machines, UML class diagrams, sequence diagrams, or system/software architecture — embed fully valid **Mermaid.js diagram syntax** (wrapped in \`\`\`mermaid) inside "diagrams_or_tables_explained", picking the Mermaid diagram type that actually fits (\`graph\`/\`flowchart\` for trees/graphs/architecture/pipelines, \`stateDiagram-v2\` for automata/state machines, \`classDiagram\` for UML, \`sequenceDiagram\` for sequence diagrams, \`erDiagram\` for database relationships), in addition to a markdown transition table when the structure has one. Never force a diagram onto content with no real graph/state/structural shape (e.g. a history, literature, or business-theory chapter) — a meaningless diagram is worse than no diagram. For ordinary tabular or comparison data with no structural shape, use a GitHub-flavored Markdown table instead.`;

// Runs first, silently, before any content is written. Downstream rules
// (CODE_PLAYGROUND_RULE, ADAPTIVE_PRACTICE_RULE, DIAGRAM_RULES) all key off
// this same classification, but since TEACHING and ASSESSMENT run as two
// INDEPENDENT parallel calls (see fullGeneration.js/chunkedGeneration.js),
// there's no shared state between them — each prompt that needs the
// classification re-derives it itself from the same source material rather
// than depending on the other call's output, so no extra round-trip is
// needed and both calls stay in sync in practice.
export const MATERIAL_CLASSIFICATION_RULE = `### MATERIAL CLASSIFICATION (decide this first, silently, before writing anything else)
Determine which ONE category best describes this material: Programming, Computer Science Theory, Mathematics, Physics, Chemistry, Biology, English, History, Business, Economics, Law, Medicine, or Other. Set \`metadata.material_category\` to this exact category string. This decision then governs every downstream call in this response — which chapters get a \`code_examples\` entry, which diagrams genuinely apply, and how much domain-specific enrichment to add. When a course spans two areas, pick whichever one determines the material's actual graded skill (e.g. a database course with some math in it is "Programming" or "Computer Science Theory", not "Mathematics").`;

// Governs the chapter-level code_examples array (schema.js CHAPTER_CORE_FIELDS)
// — used only by prompts that produce chapters (TEACHING full + chunk).
export const CODE_PLAYGROUND_RULE = `### CODE EXAMPLES (interactive playground data — programming/CS material ONLY)
Populate a chapter's \`code_examples\` array ONLY when the material is genuinely Programming or Computer Science Theory AND this specific chapter walks through real source code (a snippet, algorithm implementation, or query actually present in the material). For every other subject (History, Biology, English, Economics, Law, Medicine, ...) — or a programming chapter that's purely conceptual with nothing to walk through — \`code_examples\` MUST be an empty array. Never invent a code example that isn't grounded in the source material; never force one onto non-programming content.
When you DO populate an entry:
* \`language\`: the real language of the snippet (python, java, c, cpp, javascript, csharp, sql, html, ...).
* \`code\`: the exact or lightly-cleaned snippet from the material, properly indented.
* \`line_explanations\`: 3-8 entries, each a short quoted line/statement from \`code\` paired with what it does and why — enough that a student could reconstruct the snippet's logic from these alone.
* \`common_mistakes\`: 0-3 specific mistakes students make with THIS exact snippet or pattern (off-by-one, wrong base case, mutating while iterating, ...) — empty array if none genuinely apply.
* \`time_complexity\` / \`space_complexity\`: Big-O in LaTeX (e.g. \`$O(n \\\\log n)$\`) with a one-clause reason, or \`null\` if complexity analysis doesn't meaningfully apply (e.g. a plain SQL query or an HTML snippet).
* \`alternative_solution\`: a genuinely different approach with a one-line tradeoff comparison, or \`null\` if there's no meaningfully different way to solve it.
* \`expected_output\`: exactly what running this code prints or returns, or \`null\` if it has no observable output.`;

// Governs quiz/flashcards/practice_tasks STYLE — used only by prompts that
// produce the ASSESSMENT half (full + synthesis). Re-derives its own
// classification (see comment above) rather than reading metadata, since
// this call never sees the TEACHING half's output.
export const ADAPTIVE_PRACTICE_RULE = `### SUBJECT-ADAPTIVE PRACTICE (decide first, silently, from the material itself)
Determine which ONE category this material belongs to: Programming, Computer Science Theory, Mathematics, Physics, Chemistry, Biology, English, History, Business, Economics, Law, Medicine, or Other. Let that determine the STYLE of every exercise you write — never default to generic multiple-choice trivia regardless of subject:
* **Programming / CS Theory:** \`practice_tasks\` should be dominated by "debug this code" (a snippet with a planted bug to find), "predict the output", "complete the missing code", and complexity-analysis questions — not just prose problems.
* **Mathematics / Physics / Chemistry:** \`practice_tasks\` should be equations/numeric problems solved with a full step-by-step derivation in \`solution\`, mirroring the exact problem types the material itself demonstrates.
* **English / language courses:** favor grammar correction, vocabulary-in-context, translation, and sentence-correction style items over abstract conceptual questions.
* **History / Business / Economics / Law / Medicine / other theory-heavy subjects:** favor multiple-choice, true/false, matching, and short-answer items testing conceptual precision, causation, and application of a rule/principle to a new scenario.
Never generate coding or algorithmic exercises for a non-programming subject, and never generate equation-solving exercises for a subject with no mathematical content — every exercise in this response must feel native to the actual subject, never templated in from an unrelated domain. This applies to \`quiz\`, \`flashcards\`, and \`practice_tasks\` alike.`;

// --- Formatting rules (full + compact variants) ------------------------------
//
// The full versions below are used once per generation by the full
// single-call prompt. The chunk and synthesis prompts fire once per SOURCE
// (or per sub-chunk) and once per generation respectively, so paying for the
// full ~2.1k/~1.3k/~0.6k char versions on every one of those calls is real,
// avoidable token cost. The compact variants keep every rule that changes
// output correctness (delimiters, escaping, what counts as a real image) and
// drop only the elaborated command reference / extra prose a model already
// following the rule doesn't need restated in full every call.

// The single canonical LaTeX contract — previously restated 3 times with
// drifting wording across the full/chunk/synthesis prompts.
export const LATEX_RULES = `### LATEX FORMAT FOR TECHNICAL NOTATION
* Wrap ALL mathematical symbols, equations, logical expressions, set theory, automata/grammar notation, or complexity bounds in LaTeX, using **only** \`$inline$\` or \`$$display$$\` delimiters — with NO exceptions and NO field left out. This applies everywhere text appears, not just in a "formula" field: key points, exam focus, common mistakes, algorithm steps, comparisons, glossary meanings, learning objectives — any bullet or sentence that mentions an operator, symbol, or piece of notation (e.g. "uses $\\cdot$ for the dot product", "the sequence $a_1, a_2, \\dots, a_n$") must delimit it, never leave it as bare backslash text.
* Never use \`\\(...\\)\` or \`\\[...\\]\` — the frontend renderer only recognizes dollar-sign delimiters, and any other delimiter renders as broken raw text.
* Never wrap a plain monetary amount in \`$\` (e.g. write "costs 500 USD", not "costs $500 dollars") — a lone \`$\` immediately followed by a number is indistinguishable from a math delimiter to the renderer and will break the surrounding text.
* Use correct LaTeX commands for the domain — do not approximate with plain-text symbols:
  - Fractions/roots/powers: \`\\frac{a}{b}\`, \`\\sqrt{x}\`, \`x^2\`, \`x_i\`
  - Sums/products/limits/integrals: \`\\sum_{i=1}^{n}\`, \`\\prod\`, \`\\lim_{x \\to \\infty}\`, \`\\int_a^b\`
  - Sequences/ellipses: \`\\dots\` (never a plain "...") — e.g. \`a_1, a_2, \\dots, a_n\`
  - Set/logic notation: \`\\in, \\subseteq, \\cup, \\cap, \\forall, \\exists, \\neg, \\implies, \\iff, \\emptyset\`
  - Automata: \`$$\\delta(q_0, a) = q_1$$\`, PDA transitions \`$$(q_0, a, Z) \\rightarrow (q_1, AZ)$$\`, Turing machines \`$$\\delta(q_0, 1) = (q_1, 0, R)$$\`
  - Grammars: \`$$S \\rightarrow aSb \\mid \\varepsilon$$\`; regular expressions: \`$$(a|b)^*$$\`
  - Probability/statistics: \`P(A \\mid B), \\mathbb{E}[X], \\sigma^2\`
  - Vectors: \`\\vec{v}\`, \`\\hat{x}\`; matrices: \`\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}\` (avoid matrices unless the source material genuinely requires one — they are the single easiest LaTeX construct to get wrong)
* **Self-check before output:** for every LaTeX span you write, mentally confirm it is (a) wrapped in \`$...$\` or \`$$...$$\`, (b) uses a real LaTeX command (not a Unicode symbol substitute like ∑ or √ typed directly), and (c) has correctly doubled every backslash for JSON. A formula that fails any of these three checks must be rewritten before you finalize the response.
* **CRITICAL JSON ESCAPE RULE:** Every backslash in a LaTeX command MUST be escaped as a double backslash (\`\\\\\`) inside the JSON string. Example: \`"formula": "\\\\delta: Q \\\\times \\\\Sigma \\\\to Q"\`. Failure to do this breaks JSON.parse().`;

export const MARKDOWN_RULES = `### RICH FORMATTING FOR LONG-FORM TEXT FIELDS
Anywhere you're writing more than a sentence or two (chapter \`description\`, \`full_lecture_summary\`, practice task \`solution\`, short-answer \`expected_answer\`), the frontend renders real Markdown — use it deliberately to make content scannable and memorable, not as an afterthought:
* \`**bold**\` the specific term, number, or phrase a student should remember — not whole sentences.
* Use \`##\`/\`###\` sub-headings inside a long \`description\` if it naturally covers more than one sub-topic (e.g. "Mechanics" then "Complexity Analysis").
* Use \`- \` bullet lists for enumerable points, GitHub-flavored Markdown pipe tables (\`| Header | Header |\` with a \`|---|---|\` separator row) for any tabular/comparison data — never describe a table in prose when a real table is clearer.
* Use a fenced callout block for anything that deserves visual separation from the main narrative — a fenced code block whose language tag is one of the 7 below (e.g. \`\`\`tip\\nSome tip text\\n\`\`\`). Each renders in a distinct color, so use the one that actually matches the content:
  - \`definition\` (blue) — a precise term definition worth visually isolating from the surrounding prose.
  - \`concept\` (green) — a key idea or principle worth flagging as especially important.
  - \`example\` (purple) — a worked mini-example embedded in prose.
  - \`mistake\` (red) — a common student error or misconception, distinct from a \`warning\`.
  - \`warning\` (orange) — a caution about a limitation, edge case, or something easy to get wrong operationally.
  - \`tip\` (amber) — a study technique or mnemonic aid.
  - \`info\` (gray) — supplementary context that's useful but not core material.
  Use these sparingly — 0-3 per chapter — as emphasis, not as a container for the whole chapter. Prefer the dedicated per-chapter fields (\`common_mistakes\`, \`exam_tip\`, \`memory_trick\`) for those specific purposes; reserve inline callouts for a point that arises naturally mid-explanation and doesn't fit those fields.
* Do NOT use raw HTML, and do not use headings deeper than \`###\`.`;

// Used only where an "AVAILABLE IMAGES" manifest can be attached (full and
// chunk prompts) — synthesis works from distilled text only.
export const IMAGE_RULES = `### EMBEDDED IMAGES
Each listed image in an "AVAILABLE IMAGES" manifest (when present) was extracted directly from the source material and is attached below as inline image data — actually look at it before deciding.
* **Reference ONLY genuinely educational visuals:** diagrams, graphs, charts, architecture/system diagrams, biological/anatomical illustrations, engineering drawings, scientific figures (plots, apparatus, microscopy, etc.), and screenshots that teach something (e.g. a UI being explained, a tool's output). These earn a place in the notes because a student needs to SEE them to understand the material.
* **NEVER reference:** a formula or equation that was itself captured as an image (transcribe it as LaTeX text instead — that is always more useful than an image of math), memes, jokes, reaction images, stock photos, decorative backgrounds, logos, or icons/bullet-glyphs with no informational content. If you're unsure whether an image clears this bar, leave it out — omitting a marginal image costs nothing; including a meme or a screenshot of a formula in a student's notes actively hurts credibility and usefulness.
* For every image that clears this bar, add one entry to the "images" array of whichever "summary" chapter it belongs to, describing exactly what it shows and why it matters. Use the id exactly as given (e.g. "IMG0") — never renumber, invent, or reuse an id across chapters. If no manifest is provided, leave every chapter's "images" array empty.`;

export const LATEX_RULES_COMPACT = `### LATEX FORMAT
Wrap ALL math/logic/set-theory/complexity notation in \`$inline$\` or \`$$display$$\` — everywhere text appears (key points, algorithm steps, examples, not just a "formula" field), never as bare backslash text. Never use \`\\(...\\)\`/\`\\[...\\]\`, never wrap a plain currency amount in \`$\`. Use real LaTeX commands (\`\\frac\`, \`\\sqrt\`, \`\\sum\`, \`\\dots\`, \`\\in\`, \`\\forall\`, \`\\rightarrow\`, \`\\mid\`, etc.), never a Unicode symbol substitute. **CRITICAL JSON ESCAPE RULE:** every backslash in a LaTeX command MUST be double-escaped (\`\\\\\`) inside the JSON string.`;

export const MARKDOWN_RULES_COMPACT = `### RICH FORMATTING
The frontend renders real Markdown in long-form fields — use \`**bold**\` for the specific term/number to remember, \`- \` bullets and GitHub-flavored Markdown tables for tabular data, and (sparingly, 0-3 per chapter) a fenced callout block for anything deserving visual separation: \`\`\`definition\`\`\` (blue), \`\`\`concept\`\`\` (green), \`\`\`example\`\`\` (purple), \`\`\`mistake\`\`\` (red), \`\`\`warning\`\`\` (orange), \`\`\`tip\`\`\` (amber), \`\`\`info\`\`\` (gray) — pick the one that actually matches the content. No raw HTML, no headings deeper than \`###\`.`;

export const IMAGE_RULES_COMPACT = `### EMBEDDED IMAGES
Each image in the AVAILABLE IMAGES manifest (when present) is attached as inline image data — actually look at it. Reference ONLY genuinely educational visuals (diagrams, charts, architecture/scientific figures, informative screenshots) in the relevant chapter's "images" array, using the id exactly as given. NEVER reference a formula-as-image (transcribe as LaTeX instead), memes, logos, icons, or decorative images — if unsure, leave it out.`;

// --- Global pedagogy/style rules — split into small named pieces so each
// system prompt composes only the subset it actually needs, instead of the
// whole thing being restated (and drifting) three times. ---------------------

export const ACTIVE_LEARNING_RULE = `**Active Learning & Scaffolding:** Structure summaries and explanations to move progressively from intuitive mental models to formal mathematical/technical definitions, followed by concrete applications and worked problems.`;

export const DEEP_COMPREHENSION_RULE = `**Deep Comprehension over Rote Memorization:** Quiz questions, true/false items, and practice tasks must target conceptual understanding, edge cases, and analysis rather than simple recall (see the QUIZ and FLASHCARDS rules above for specifics). **Difficulty distribution:** across the full \`quiz\` array, and separately across the full \`practice_tasks\` array, aim for roughly 30% easy / 40% medium / 30% hard — do not label every item "medium". Use this rubric: **easy** = single-fact recall or a direct definition; **medium** = applying one formula/rule or connecting two concepts; **hard** = multi-step reasoning, an edge case, or synthesizing several concepts together.`;

export const CHAPTER_LENGTH_RULE = `**Chapter length calibration (textbook depth, not summary depth):** \`description\` (per chapter) is 200-450 words of genuine multi-paragraph teaching prose — enough room to actually move through intuition, formal mechanics, and how it connects to a concrete example, not a single compressed paragraph gesturing at the topic. If a chapter feels thin at 200 words, that is a signal the chapter's scope is too broad — split it into two chapters rather than writing a thin one. Do not pad any field with filler, throat-clearing, or restated question text to hit these numbers.`;

// The "premium study notes" fields (key_idea/easy_explanation/advanced_explanation/
// real_world_analogy/memory_trick/common_mistakes/exam_tip on every chapter) are
// what separates this from a plain AI summary — but each is deliberately short
// (one sentence to a few), so the added richness doesn't blow up output size or
// generation time. Nullable fields (advanced_explanation/real_world_analogy/
// memory_trick/exam_tip) should still be filled in whenever a genuine one
// exists — leave null only when nothing authentic fits, never as a shortcut.
export const PREMIUM_ENRICHMENT_RULE = `**Premium enrichment fields (every chapter):** \`key_idea\` is the one sentence a student should remember even if they forget everything else — make it punchy and specific, not a generic restatement of the title. \`easy_explanation\` uses zero jargon, as if explaining to a smart friend outside the field. \`advanced_explanation\` adds real depth (an edge case, a connection to more advanced material) beyond \`description\` — not a rephrasing of it. \`real_world_analogy\` and \`memory_trick\` should be genuinely vivid and specific to this exact content, never generic ("it's like a system that organizes things") — write \`null\` rather than force a weak one. \`common_mistakes\` names real, specific traps (0-3 items, empty array if none apply) — not vague cautions. \`exam_tip\` names an actual testable pattern for this topic, or \`null\` if this material isn't typically assessed directly.`;

export const CONTENT_LENGTH_RULE = `**Content length calibration:** \`definition\` (core concept) is 2-4 sentences: the precise definition, then the one distinction students most often get wrong. \`explanation\` (quiz/true-false) is 3-5 sentences and must say why the correct answer is right AND why the main distractor(s) are wrong. \`solution\` (practice task) is as long as the derivation genuinely requires, fully worked, not truncated for brevity. Do not pad any field with filler to hit these numbers.`;

export const FIDELITY_AUDIT_RULE = `**Fidelity to Source, With an Audit Trail:** Do not invent external case studies or history not mentioned. Raw transcripts often contain phonetic/homophone transcription errors (e.g., "vertex" mis-heard as "vortex", "SQL" as "sequel", "graph" as "giraffe"). You may contextually heal these into their correct domain-specific technical term, but every such correction MUST be logged as an entry in the top-level \`transcription_corrections\` array — never silently rewrite the source without a record of what you changed and why. If you made no corrections, return an empty array for that field.`;

export const NO_REPETITION_RULE = `**No repetition across sections:** the same fact, definition, or explanation must not be restated near-verbatim in multiple places (e.g. \`core_concepts.definition\` vs \`glossary.meaning\` vs \`study_notes.main_ideas\` for the same term). Each section has a distinct job — \`summary\` narrates and teaches, \`core_concepts\` gives the precise reference definition, \`glossary\` is a terse lookup, \`study_notes\` is exam-oriented distillation. Write each field to serve its own job; cross-reference by name rather than re-explaining.`;

export const STYLE_VARIETY_RULE = `**Vary your phrasing:** do not open consecutive chapters with the same sentence template (e.g. always starting with "This chapter covers..." or "X is a concept that..."). Vary sentence openers and structure across chapters the way a human author would — repetitive templated phrasing is a tell that reduces trust in the material's quality even when the content itself is correct.`;

// States the exact contract the runtime validator (ai/pipeline/sectionValidators.js
// + ai/pipeline/packageValidator.js) checks after the fact, so the model is
// told the acceptance bar up front instead of only discovering a mismatch
// later.
export const VALIDATION_RULES = `### VALIDATION CONTRACT (your response is checked against this — meet it the first time)
* Every array-shaped section requested (quiz, flashcards, practice_tasks, true_false_questions, short_answer_questions) must be non-empty and contain a count reasonably close to the target given in TARGET CONTENT COUNTS — well outside that range is treated as a broken response.
* Every quiz item's \`correctAnswer\` must match the text of one of its \`options\` **exactly**, character for character — not a paraphrase, not a different case/whitespace.
* Every \`true_false_questions\` item's \`answer\` must be a literal JSON boolean (\`true\`/\`false\`), never a string.
* Every image reference's \`id\` must be one of the exact ids given in the AVAILABLE IMAGES manifest — an invented or reused id is dropped and wastes the reference.
* Do not add, rename, or omit any top-level JSON key from the REQUIRED JSON STRUCTURE below — an extra key is ignored, a missing required one fails validation.
* \`metadata.video_title\` (full/synthesis calls) must always be a non-empty, meaningful string.`;

// The strict-formatting footer, appended verbatim to every system prompt.
export const OUTPUT_REQUIREMENTS = `### STRICT OUTPUT FORMATTING GUARDRAILS
* The very first character of your response must be \`{\` and the very last must be \`}\` — nothing before it, nothing after it. No "Here is the study package:", no summary of what you did, no markdown code fences (do NOT wrap the output in \`\`\`json), no trailing commas.
* Return ONLY one perfectly valid JSON object.
* Output language must be entirely English.`;
