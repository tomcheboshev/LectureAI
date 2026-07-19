// JSON Validator + Final Validation stage — and the single most important
// behavioral change in this pipeline: SOFT validation. The old validator
// threw on the first bad section, discarding every other section that was
// actually fine (one flaky "practice_tasks" response meant re-paying for a
// perfectly good summary/quiz/flashcards too). This one never throws for a
// bad section — it repairs what it can locally (same item-level salvage as
// before) and reports what's still broken in `sections`, so the caller
// (recoveryManager.js) can regenerate ONLY those sections and merge the
// result back in. The user never sees the difference between "generated
// correctly the first time" and "one section needed a quiet retry."
//
// The only thing that still throws here is a structurally unusable response
// (not an object at all) — that's not a validation failure to recover from,
// it's not a package.

import {
  isNonEmptyString,
  withinRange,
  SCALED_SECTIONS,
  repairItems,
  repairQuizItem,
  repairTrueFalseItem,
  sanitizeChapterImages,
  sanitizeChapterFormulas,
} from "./sectionValidators.js";

// Per-section item-level repair rules, shared between full-package
// validation and single-section regeneration validation (sectionGeneration.js)
// — one definition of "what a valid quiz item looks like," used everywhere
// a quiz section is checked instead of two copies drifting apart.
const ITEM_REPAIR_CONFIG = {
  quiz: { fieldsRequired: ["question", "explanation"], repair: repairQuizItem },
  flashcards: { fieldsRequired: ["front", "back"] },
  true_false_questions: { fieldsRequired: ["statement", "explanation"], repair: repairTrueFalseItem },
  short_answer_questions: { fieldsRequired: ["question", "expected_answer"] },
  practice_tasks: { fieldsRequired: ["task", "solution"] },
  glossary: { fieldsRequired: ["term", "meaning"] },
  core_concepts: { fieldsRequired: ["term", "definition"] },
};

// Sections that must end up genuinely non-empty (after repair) and within
// range of their target count to count as "ok" — an empty or wildly-off
// result here is a real content gap worth one recovery attempt.
const REQUIRED_NONEMPTY_SECTIONS = ["quiz", "flashcards", "true_false_questions", "short_answer_questions", "practice_tasks", "core_concepts"];

function repairArraySection(pkg, field) {
  const { items, warnings } = repairItems(pkg[field], ITEM_REPAIR_CONFIG[field]);
  pkg[field] = items;
  return warnings;
}

function validateSummary(pkg, validIds, report, warnings) {
  if (!Array.isArray(pkg.summary)) pkg.summary = [];
  pkg.summary = pkg.summary
    .filter((c) => isNonEmptyString(c?.topic_title) && isNonEmptyString(c?.description))
    .map((c) => ({
      ...c,
      images: sanitizeChapterImages(c.images, validIds, warnings),
      formulas: sanitizeChapterFormulas(c.formulas, warnings),
    }));
  report.summary = pkg.summary.length > 0 ? { ok: true } : { ok: false, reason: "summary is missing or has no usable chapters." };
}

function validateStudyNotes(pkg, report, warnings) {
  if (!pkg.study_notes || typeof pkg.study_notes !== "object") {
    warnings.push("study_notes missing or malformed — defaulted.");
    pkg.study_notes = {};
  }
  for (const field of ["main_ideas", "important_details", "formulas_or_rules", "processes_or_steps", "common_misunderstandings", "exam_focus"]) {
    if (!Array.isArray(pkg.study_notes[field])) pkg.study_notes[field] = [];
  }
  if (!Array.isArray(pkg.study_notes.comparisons)) pkg.study_notes.comparisons = [];

  const hasContent = pkg.study_notes.main_ideas.length > 0 || pkg.study_notes.important_details.length > 0;
  report.study_notes = hasContent ? { ok: true } : { ok: false, reason: "study_notes is missing or empty." };
}

// Sections beyond the ones tracked in `sections` still need normalizing —
// an omitted/malformed study_scaffolding/chatbot_context/etc. would
// otherwise still slip through as "completed." These always default to a
// safe empty value rather than being flagged for recovery: none of them are
// as user-blocking as a missing quiz/summary, and there's no
// REGENERATABLE_SECTIONS entry for most of them anyway.
function defaultAuxiliaryFields(pkg) {
  if (!pkg.study_scaffolding || typeof pkg.study_scaffolding !== "object") {
    pkg.study_scaffolding = { mental_model_anchor: "", cognitive_roadmap: [], retention_strategy: "" };
  }
  if (!Array.isArray(pkg.edge_cases_and_limits)) pkg.edge_cases_and_limits = [];
  if (!Array.isArray(pkg.learning_objectives)) pkg.learning_objectives = [];
  if (!Array.isArray(pkg.prerequisites)) pkg.prerequisites = [];
  if (!Array.isArray(pkg.recommended_next_steps)) pkg.recommended_next_steps = [];
  if (!Array.isArray(pkg.transcription_corrections)) pkg.transcription_corrections = [];

  if (!pkg.chatbot_context || typeof pkg.chatbot_context !== "object") pkg.chatbot_context = {};
  for (const field of ["key_takeaways", "important_terms", "rules_formulas_or_methods", "student_confusion_points", "suggested_student_prompts"]) {
    if (!Array.isArray(pkg.chatbot_context[field])) pkg.chatbot_context[field] = [];
  }
  if (!isNonEmptyString(pkg.chatbot_context.lecture_overview)) pkg.chatbot_context.lecture_overview = pkg.full_lecture_summary || "";
}

/**
 * Soft-validates and locally repairs a freshly generated package.
 * Never throws for a bad section — only if `pkg` itself isn't a usable
 * object at all. Returns { pkg, sections, warnings }, where `sections` maps
 * every checked section name to `{ ok: true }` or `{ ok: false, reason }`.
 */
export function validateSections(pkg, counts, images = []) {
  if (!pkg || typeof pkg !== "object") {
    throw new Error("The AI did not return a usable study package object.");
  }

  const validIds = new Set(images.map((img) => img.id));
  const warnings = [];
  const report = {};

  if (!pkg.metadata || typeof pkg.metadata !== "object") pkg.metadata = {};

  validateSummary(pkg, validIds, report, warnings);
  validateStudyNotes(pkg, report, warnings);

  for (const field of ["quiz", "flashcards", "true_false_questions", "short_answer_questions", "practice_tasks", "core_concepts", "glossary"]) {
    warnings.push(...repairArraySection(pkg, field));
    if (!REQUIRED_NONEMPTY_SECTIONS.includes(field)) {
      report[field] = { ok: true }; // glossary: "up to N terms" — legitimately allowed to be empty
      continue;
    }
    const countKey = SCALED_SECTIONS[field];
    const count = pkg[field].length;
    if (count === 0) {
      report[field] = { ok: false, reason: `"${field}" had no valid items after repair.` };
    } else if (countKey && !withinRange(count, counts[countKey])) {
      report[field] = { ok: false, reason: `"${field}" has ${count} items — expected roughly ${counts[countKey]} for this amount of material.` };
    } else {
      report[field] = { ok: true };
    }
  }

  defaultAuxiliaryFields(pkg);

  if (warnings.length) console.warn("[package-validator] warnings:", warnings);

  return { pkg, sections: report, warnings };
}

/**
 * Validates/repairs the raw value of ONE regenerated section (the response
 * to a targeted single-section AI call) — shared by recoveryManager.js
 * (automatic recovery during generation) and sectionGeneration.js (the
 * manual /regenerate route), so both paths hold a regenerated section to
 * the same bar instead of two hand-rolled checks. Throws if the section is
 * still unusable after repair — the caller decides what to do with that
 * (recoveryManager defaults to empty and continues; the manual route
 * surfaces the error to the user).
 */
export function validateSectionValue(section, value, counts) {
  if (value === undefined || value === null) {
    throw new Error(`The AI's response is missing the "${section}" section.`);
  }

  const repairConfig = ITEM_REPAIR_CONFIG[section];
  if (repairConfig) {
    if (!Array.isArray(value)) throw new Error(`"${section}" must be an array.`);
    const { items, warnings } = repairItems(value, repairConfig);
    if (items.length === 0) throw new Error(`"${section}" had no valid items after repair.`);
    if (warnings.length) console.warn(`[package-validator] "${section}" regeneration warnings:`, warnings);
    value = items;

    const countKey = SCALED_SECTIONS[section];
    if (countKey && !withinRange(value.length, counts[countKey])) {
      throw new Error(`"${section}" has ${value.length} items — expected roughly ${counts[countKey]} for this amount of material.`);
    }
    return value;
  }

  if (section === "summary") {
    if (!Array.isArray(value) || value.length === 0) throw new Error('"summary" must be a non-empty array.');
    return value;
  }
  if (section === "study_notes" || section === "edge_cases_and_limits") {
    return value;
  }

  return value;
}
