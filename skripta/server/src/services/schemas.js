import { Type } from "@google/genai";

// Structured-output schemas for Gemini's `responseSchema` config — used
// alongside (not instead of) the prose instructions in prompt.js. This is
// applied first to the narrow, single-key regenerate calls: each one has a
// small, well-bounded shape, so the reliability win is large relative to the
// authoring cost. The full mega-prompt generation call has looser/Mixed
// fields (chatbot_context, study_notes.comparisons) and is left on prose
// instructions + jsonrepair only for now, to avoid Gemini silently dropping
// fields under an overly-strict schema there.

const STRING = { type: Type.STRING };
const STRING_ARRAY = { type: Type.ARRAY, items: STRING };

const FORMULA = {
  type: Type.OBJECT,
  properties: { name: STRING, formula: STRING, variables: STRING, when_to_use: STRING, example: STRING },
  required: ["name", "formula"],
};

const CHAPTER = {
  type: Type.OBJECT,
  properties: {
    source_index: { type: Type.INTEGER },
    source_title: { ...STRING, nullable: true },
    timestamp: { type: Type.NUMBER },
    topic_title: STRING,
    description: STRING,
    formulas: { type: Type.ARRAY, items: FORMULA },
    algorithms_or_processes: STRING_ARRAY,
    diagrams_or_tables_explained: STRING_ARRAY,
    code_explained: STRING_ARRAY,
    examples: STRING_ARRAY,
    key_points: STRING_ARRAY,
  },
  required: ["topic_title", "description"],
};

const CORE_CONCEPT = {
  type: Type.OBJECT,
  properties: {
    term: STRING,
    definition: STRING,
    why_it_matters: STRING,
    related_concepts: STRING_ARRAY,
    common_mistakes: STRING,
    example: STRING,
  },
  required: ["term", "definition"],
};

const STUDY_NOTES = {
  type: Type.OBJECT,
  properties: {
    main_ideas: STRING_ARRAY,
    important_details: STRING_ARRAY,
    formulas_or_rules: STRING_ARRAY,
    processes_or_steps: STRING_ARRAY,
    comparisons: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { concept_a: STRING, concept_b: STRING, difference: STRING },
        required: ["concept_a", "concept_b", "difference"],
      },
    },
    common_misunderstandings: STRING_ARRAY,
    exam_focus: STRING_ARRAY,
  },
};

const QUIZ_ITEM = {
  type: Type.OBJECT,
  properties: {
    question: STRING,
    options: STRING_ARRAY,
    correctAnswer: STRING,
    explanation: STRING,
    difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
    concept_tested: STRING,
  },
  required: ["question", "options", "correctAnswer"],
};

const FLASHCARD_ITEM = {
  type: Type.OBJECT,
  properties: {
    front: STRING,
    back: STRING,
    category: STRING,
    prompt_type: STRING,
    retention_hint: STRING,
  },
  required: ["front", "back"],
};

const PRACTICE_TASK = {
  type: Type.OBJECT,
  properties: {
    task: STRING,
    difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
    hint: STRING,
    solution: STRING,
    concepts_used: STRING_ARRAY,
  },
  required: ["task", "solution"],
};

const EDGE_CASE = {
  type: Type.OBJECT,
  properties: { scenario: STRING, behavior: STRING, fix_or_mitigation: STRING },
  required: ["scenario", "behavior"],
};

const TRUE_FALSE_ITEM = {
  type: Type.OBJECT,
  properties: { statement: STRING, answer: { type: Type.BOOLEAN }, explanation: STRING },
  required: ["statement", "answer"],
};

const SHORT_ANSWER_ITEM = {
  type: Type.OBJECT,
  properties: { question: STRING, expected_answer: STRING, grading_hint: STRING },
  required: ["question", "expected_answer"],
};

const GLOSSARY_ITEM = {
  type: Type.OBJECT,
  properties: { term: STRING, meaning: STRING },
  required: ["term", "meaning"],
};

// One schema per REGENERATABLE_SECTIONS key (prompt.js), wrapping the
// section's array/object shape in the single top-level key Gemini must
// return for a regenerate call.
export const REGENERATE_RESPONSE_SCHEMAS = {
  summary: wrap("summary", { type: Type.ARRAY, items: CHAPTER }),
  core_concepts: wrap("core_concepts", { type: Type.ARRAY, items: CORE_CONCEPT }),
  study_notes: wrap("study_notes", STUDY_NOTES),
  quiz: wrap("quiz", { type: Type.ARRAY, items: QUIZ_ITEM }),
  flashcards: wrap("flashcards", { type: Type.ARRAY, items: FLASHCARD_ITEM }),
  practice_tasks: wrap("practice_tasks", { type: Type.ARRAY, items: PRACTICE_TASK }),
  edge_cases_and_limits: wrap("edge_cases_and_limits", { type: Type.ARRAY, items: EDGE_CASE }),
  true_false_questions: wrap("true_false_questions", { type: Type.ARRAY, items: TRUE_FALSE_ITEM }),
  short_answer_questions: wrap("short_answer_questions", { type: Type.ARRAY, items: SHORT_ANSWER_ITEM }),
  glossary: wrap("glossary", { type: Type.ARRAY, items: GLOSSARY_ITEM }),
};

function wrap(key, schema) {
  return { type: Type.OBJECT, properties: { [key]: schema }, required: [key] };
}
