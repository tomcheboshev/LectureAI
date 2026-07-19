// Section-level and item-level repair/validation helpers shared by both the
// full-package validator (packageValidator.js) and single-section
// regeneration (generation/sectionGeneration.js) — one set of rules, used
// everywhere a section can be checked, instead of the same checks
// hand-duplicated per call site.

export function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Content counts (quiz, flashcards, ...) scale with material size, so we
// can't check for one exact number. Instead check each array is within a
// generous range around the target we asked for — this still catches a
// genuinely broken response (empty array, wildly off) without failing over
// the model producing 7 questions instead of the suggested 6.
export function withinRange(actual, target) {
  const min = Math.max(2, Math.round(target * 0.5));
  const max = Math.round(target * 1.6) + 3;
  return actual >= min && actual <= max;
}

// Maps each count-scaled section to its key in the suggestedCounts() result.
export const SCALED_SECTIONS = {
  quiz: "quiz",
  flashcards: "flashcards",
  practice_tasks: "practice",
  true_false_questions: "trueFalse",
  short_answer_questions: "shortAnswer",
};

// Repairs/prunes an array of items in place rather than failing the whole
// section over one malformed entry — a single bad quiz question shouldn't
// discard an otherwise-good 20-question set. Returns { items, warnings }.
export function repairItems(arr, { fieldsRequired = [], repair } = {}) {
  const warnings = [];
  const items = [];
  for (const [i, item] of (arr || []).entries()) {
    const repaired = repair ? repair(item, warnings, i) : item;
    if (!repaired) {
      warnings.push(`Item ${i} dropped: failed validation.`);
      continue;
    }
    const missing = fieldsRequired.filter((f) => !isNonEmptyString(repaired[f]));
    if (missing.length) {
      warnings.push(`Item ${i} dropped: missing/empty field(s) ${missing.join(", ")}.`);
      continue;
    }
    items.push(repaired);
  }
  return { items, warnings };
}

// A quiz item is useless to the frontend (QuizPlayer.vue compares
// `selected === correctAnswer`) unless correctAnswer matches one of the
// options verbatim. The model sometimes paraphrases it slightly — repair
// via a case/whitespace-insensitive match before giving up on the item.
export function repairQuizItem(item, warnings, i) {
  if (!Array.isArray(item?.options) || item.options.length < 2 || !isNonEmptyString(item.question)) return null;
  if (item.options.includes(item.correctAnswer)) return item;

  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const match = item.options.find((o) => norm(o) === norm(item.correctAnswer));
  if (match) {
    warnings.push(`Quiz item ${i}: correctAnswer repaired to match option text exactly.`);
    return { ...item, correctAnswer: match };
  }
  warnings.push(`Quiz item ${i}: correctAnswer "${item.correctAnswer}" matches no option — dropped.`);
  return null;
}

export function repairTrueFalseItem(item) {
  if (!isNonEmptyString(item?.statement)) return null;
  const answer = typeof item.answer === "boolean" ? item.answer : String(item.answer).trim().toLowerCase() === "true";
  return { ...item, answer };
}

export function validateGlossary(pkg, warnings) {
  const { items } = repairItems(pkg.glossary, { fieldsRequired: ["term", "meaning"] });
  if (items.length === 0 && (pkg.glossary || []).length > 0) {
    warnings.push("glossary: all items were malformed and dropped.");
  }
  pkg.glossary = items;
}

// The model can only legitimately reference an image id we actually sent it
// (it has no other way to know what "IMG3" is) — anything else is either a
// hallucinated id or a stale one from a differently-shaped request, and
// letting it through would mean the frontend renders a broken/missing image.
export function sanitizeChapterImages(images, validIds, warnings) {
  if (!Array.isArray(images) || images.length === 0) return [];
  const kept = images.filter(
    (img) => isNonEmptyString(img?.id) && validIds.has(img.id) && isNonEmptyString(img?.caption) && isNonEmptyString(img?.explanation)
  );
  if (kept.length !== images.length) warnings.push(`summary chapter images: ${images.length - kept.length} invalid/hallucinated reference(s) dropped.`);
  return kept;
}

// Regex-based local sanity check for one formula's LaTeX source string —
// catches the cheap, purely structural ways generated LaTeX breaks KaTeX
// rendering (unbalanced braces, a trailing dangling backslash, a stray
// literal '$' — formula strings are raw LaTeX source the frontend wraps in
// $...$/$$...$$ itself, so a '$' inside one is always a mistake) without
// needing a KaTeX dependency on the server. This is a structural check, not
// a full LaTeX grammar validator — it cannot catch every possible way a
// formula is wrong, only the ways that reliably break rendering outright.
export function validateFormula(formula) {
  if (!isNonEmptyString(formula)) return false;

  // A real control character (tab/newline/CR/backspace/formfeed) has no
  // legitimate place in a single formula string. Its most likely cause is
  // upstream JSON-escape repair: valid JSON already treats a bare "\t",
  // "\n", "\f", "\b", or "\r" as that literal control character, so when
  // the model emits an under-escaped LaTeX macro (`\times`, `\nabla`,
  // `\frac`, `\rightarrow`, `\begin`) instead of the required doubled
  // backslash, JSON.parse silently consumes the macro's leading letter as
  // a control-character escape and corrupts the rest into literal text —
  // no parse error, just quietly broken LaTeX. Rejecting any formula that
  // contains one of these catches that corruption before it reaches KaTeX.
  if (/[\t\n\r\b\f]/.test(formula)) return false;

  let depth = 0;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === "\\") {
      i++; // skip the escaped character, whatever it is (including another backslash or a brace)
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) return false;
    }
  }
  if (depth !== 0) return false;
  if (/\\$/.test(formula)) return false; // dangling backslash with nothing to escape
  if (formula.includes("$")) return false;

  return true;
}

// Drops any formula entry whose LaTeX fails validateFormula — one malformed
// formula shouldn't cost the whole chapter, the same principle
// sanitizeChapterImages applies to image references.
export function sanitizeChapterFormulas(formulas, warnings) {
  if (!Array.isArray(formulas) || formulas.length === 0) return [];
  const kept = formulas.filter((f) => validateFormula(f?.formula));
  const dropped = formulas.length - kept.length;
  if (dropped > 0) warnings.push(`chapter formulas: ${dropped} entr${dropped === 1 ? "y" : "ies"} with malformed LaTeX dropped.`);
  return kept;
}
