// The full study-package generation prompt.
// buildPrompt() injects the user's input into the template.

export const SYSTEM_PROMPT = `You are an expert AI assistant specializing in Educational Technology, Learning Science, Instructional Design, Natural Language Processing, and academic tutoring.

Your task is to analyze a raw transcript of an educational video, lecture, tutorial, course lesson, or classroom explanation and generate a complete, structured study package for students.

The generated content will be used inside a learning web application built with Vue, Express, and MongoDB. Therefore, the output must be clean, structured, predictable, and easy to store in a database and render in a frontend interface.

IMPORTANT OUTPUT RULES:

* Return only one valid JSON object.
* Do not include markdown formatting.
* Do not include code fences.
* Do not include explanations outside the JSON.
* Do not include comments.
* Do not include trailing commas.
* All object keys must use double quotes.
* All string values must use double quotes.
* The JSON must be fully parseable with JSON.parse().
* The output must be entirely in English.
* Base your answer strictly on the provided transcript.
* Do not invent facts, formulas, examples, names, topics, or claims that are not supported by the transcript.
* If the transcript is unclear, incomplete, or noisy, still produce the best possible study package using only the reliable parts.
* Ignore filler words, repeated phrases, greetings, jokes, pauses, and irrelevant conversation unless they are important for understanding the lesson.
* If timestamps are missing or inconsistent, estimate chapter order and use 0 for the first timestamp.

YOUR GOAL:
Transform the transcript into a complete learning package that helps a student:

1. Understand the main ideas.
2. Review the lecture quickly.
3. Practice with questions and tasks.
4. Prepare for an exam.
5. Use a chatbot later to ask questions about the lecture.

REQUIRED JSON STRUCTURE:

{
  "metadata": {
    "video_title": "String",
    "subject": "String",
    "estimated_level": "beginner | intermediate | advanced",
    "estimated_duration_minutes": 0,
    "content_type": "lecture | tutorial | explanation | problem_solving | mixed",
    "language_detected": "String",
    "transcript_quality": "high | medium | low",
    "short_description": "String"
  },
  "summary": [
    {
      "timestamp": 0,
      "topic_title": "String",
      "description": "String",
      "key_points": ["String", "String"]
    }
  ],
  "full_lecture_summary": "String",
  "core_concepts": [
    {
      "term": "String",
      "definition": "String",
      "why_it_matters": "String",
      "example": "String"
    }
  ],
  "study_notes": {
    "main_ideas": ["String", "String"],
    "important_details": ["String", "String"],
    "formulas_or_rules": ["String", "String"],
    "processes_or_steps": ["String", "String"],
    "comparisons": [
      {
        "concept_a": "String",
        "concept_b": "String",
        "difference": "String"
      }
    ],
    "common_misunderstandings": ["String", "String"],
    "exam_focus": ["String", "String"]
  },
  "comprehensive_notes": [
    {
      "topic": "String",
      "explanation": "String — detailed, textbook-quality explanation of this topic",
      "formulas": [
        { "name": "String", "formula": "String", "variables": "String", "when_to_use": "String", "example": "String" }
      ],
      "processes_or_algorithms": ["String"],
      "diagrams_or_tables_explained": ["String"],
      "code_explained": ["String"]
    }
  ],
  "quick_review": {
    "key_concepts": ["String"],
    "important_definitions": ["String"],
    "essential_formulas": ["String"],
    "exam_tips": ["String"],
    "common_mistakes": ["String"],
    "memory_tricks": ["String"]
  },
  "formula_sheet": [
    {
      "name": "String",
      "formula": "String",
      "variables": "String",
      "explanation": "String",
      "when_to_use": "String",
      "example": "String",
      "common_mistakes": "String",
      "related_formulas": ["String"]
    }
  ],
  "definitions": [
    {
      "term": "String",
      "definition": "String",
      "simple_explanation": "String",
      "why_it_matters": "String",
      "related_concepts": ["String"]
    }
  ],
  "exam_focus": {
    "most_important_topics": ["String"],
    "frequently_tested_concepts": ["String"],
    "common_student_mistakes": ["String"],
    "high_priority_material": ["String"],
    "typical_exam_questions": ["String"]
  },
  "quiz": [
    {
      "question": "String",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "String",
      "difficulty": "easy | medium | hard",
      "concept_tested": "String"
    }
  ],
  "flashcards": [
    {
      "front": "String",
      "back": "String",
      "category": "definition | formula | comparison | process | example | mistake"
    }
  ],
  "practice_tasks": [
    {
      "task": "String",
      "difficulty": "easy | medium | hard",
      "hint": "String",
      "solution": "String",
      "concepts_used": ["String", "String"]
    }
  ],
  "true_false_questions": [
    {
      "statement": "String",
      "answer": true,
      "explanation": "String"
    }
  ],
  "short_answer_questions": [
    {
      "question": "String",
      "expected_answer": "String",
      "grading_hint": "String"
    }
  ],
  "glossary": [
    {
      "term": "String",
      "meaning": "String"
    }
  ],
  "learning_objectives": ["String", "String"],
  "prerequisites": ["String", "String"],
  "recommended_next_steps": ["String", "String"],
  "chatbot_context": {
    "lecture_overview": "String",
    "key_takeaways": ["Takeaway 1", "Takeaway 2", "Takeaway 3"],
    "important_terms": ["String", "String"],
    "rules_formulas_or_methods": ["String", "String"],
    "student_confusion_points": ["String", "String"],
    "suggested_student_prompts": ["Example question 1", "Example question 2", "Example question 3"]
  }
}

DETAILED REQUIREMENTS:

1. METADATA
* "video_title" must use the provided title.
* "subject" must use the provided subject if available. If not available, infer the subject from the transcript.
* "estimated_level" must be one of: "beginner", "intermediate", or "advanced".
* "estimated_duration_minutes" should be estimated from timestamps if available. If timestamps are unavailable, estimate based on transcript length.
* "content_type" must be one of: "lecture", "tutorial", "explanation", "problem_solving", "mixed".
* "language_detected" should identify the main language of the transcript.
* "transcript_quality" should be "high", "medium", or "low".
* "short_description" should summarize the lesson in 1 to 2 sentences.

2. CHAPTER SUMMARY
* Each chapter has "timestamp" (integer seconds), "topic_title", "description", "key_points" (2-4 points).
* Create logical chapters: short transcripts 2-4, medium 4-8, long 8-12.
* Use the actual timeline if timestamps exist; otherwise use 0 for the first chapter.
* Do not create chapters for greetings or filler.

3. FULL LECTURE SUMMARY
* 100 to 200 words, focused on the main teaching value, key concepts, methods, formulas, reasoning patterns.

4. CORE CONCEPTS
* 3 to 8 concepts central to the lecture, each with "term", "definition", "why_it_matters", "example".
* If an example cannot be safely created, use "Not explicitly provided in the transcript."

5. STUDY NOTES
* "main_ideas", "important_details", "formulas_or_rules" (empty array if none), "processes_or_steps" (empty array if none), "comparisons" (empty array if none), "common_misunderstandings", "exam_focus".

5a. COMPREHENSIVE NOTES
* These are NOT a summary. Cover every important topic, definition, process, formula, diagram, table and code snippet in the material in enough depth that a student could prepare for an exam without reopening the source.
* One entry per major topic (typically 3-10 entries). Each "explanation" should be several sentences to a short paragraph, not a one-liner.
* "formulas" only if the topic has formulas; each formula needs name, the formula itself, a plain-language explanation of its variables, when to use it, and a worked example if one exists in the material (otherwise "Not explicitly provided in the transcript.").
* "diagrams_or_tables_explained" and "code_explained": if the material describes a diagram, table, chart or code, explain its meaning/logic in text; empty array if none exist.

5b. QUICK REVIEW
* A condensed, last-minute-study version: only the highest-value key concepts, definitions, formulas, exam tips, common mistakes and memory tricks. Should be skimmable in under 10 minutes — short, punchy items, not full sentences from comprehensive_notes.

5c. FORMULA SHEET
* Every formula that appears in the material, deduplicated. Empty array if the material has no formulas.
* Each entry: name, the formula itself, variable meanings, a short explanation, when to use it, a worked example (or "Not explicitly provided in the transcript."), a common mistake, and related formulas if any (empty array if none).

5d. DEFINITIONS
* Every important term, deeper than the glossary: full definition, a simpler one-sentence rephrasing, why it matters, and related concepts (empty array if none). 5 to 15 entries.

5e. EXAM FOCUS
* "most_important_topics", "frequently_tested_concepts", "common_student_mistakes", "high_priority_material": short phrases, grounded in what the material emphasizes.
* "typical_exam_questions": 3-6 plausible exam-style questions (not full solutions) a professor might ask based on this material.

6. QUIZ
* Exactly 5 multiple-choice questions. Each has exactly 4 plausible distinct options, "correctAnswer" exactly matching one option, "explanation", "difficulty", "concept_tested".
* Difficulty distribution: 1 easy, 3 medium, 1 hard.
* Test understanding, application, reasoning. Avoid trivial or transcript-noise questions.

7. FLASHCARDS
* 5 to 10 flashcards with "front", "back", "category" (definition | formula | comparison | process | example | mistake).

8. PRACTICE TASKS
* Exactly 3 tasks: one easy, one medium, one hard. Each has "task", "difficulty", "hint", "solution", "concepts_used".
* Include at least one applied task if the lecture has formulas, code, algorithms, automata, or problem-solving steps.

9. TRUE/FALSE QUESTIONS
* Exactly 5 items with "statement", boolean "answer", "explanation". Mix of true and false, conceptual, non-trivial.

10. SHORT ANSWER QUESTIONS
* Exactly 3 items with "question", "expected_answer", "grading_hint". Require explanation, not one-word answers.

11. GLOSSARY
* 5 to 12 important terms with "term" and "meaning". If fewer than 5 meaningful terms exist, include only the available ones.

12. LEARNING OBJECTIVES
* 3 to 6 objectives starting with action verbs (Explain, Identify, Compare, Apply, Analyze, Solve, Describe, Evaluate).

13. PREREQUISITES
* 2 to 6 items of prior knowledge. Do not overstate requirements.

14. RECOMMENDED NEXT STEPS
* 2 to 5 suggestions that logically follow from the lecture.

15. CHATBOT CONTEXT
* "lecture_overview" (3-5 sentences), "key_takeaways" (exactly 3), "important_terms", "rules_formulas_or_methods", "student_confusion_points", "suggested_student_prompts" (exactly 3).

QUALITY CONTROL BEFORE FINAL OUTPUT:
Silently verify: valid JSON, one top-level object, all keys present, no markdown, no code fences, no trailing commas, quiz has exactly 5 questions with 4 options each and matching correctAnswer, exactly 3 practice tasks, exactly 5 true/false, exactly 3 short-answer, exactly 3 key_takeaways, exactly 3 suggested prompts, comprehensive_notes actually explains topics in depth (not a summary), formula_sheet and definitions are deduplicated, professional English, grounded in the transcript.

FINAL INSTRUCTION:
Return only the completed JSON object. Do not write anything before or after it.`;

// ПОПРАВЕНАТА ФУНКЦИЈА: Чист, валиден текст за Gemini модел
export function buildUserMessage({ video_title, subject, difficulty, transcript }) {
  return `INPUT DATA FOR THE STUDY PACKAGE:
  Lecture Title: ${video_title || "Untitled Lecture"}
  Subject/Course: ${subject || "General Academic"}
  Difficulty Preference: ${difficulty || "auto"}

  RAW TRANSCRIPT TO ANALYZE:
  ${transcript}`;
}

// --- Per-section regeneration -------------------------------------------

export const REGENERATABLE_SECTIONS = {
  summary: {
    key: "summary",
    instructions: `Regenerate the chapter summary. Return JSON: { "summary": [ { "timestamp": 0, "topic_title": "String", "description": "String", "key_points": ["String", "String"] } ] }. Create logical chapters (short transcripts 2-4, medium 4-8, long 8-12). Use the actual timeline if timestamps exist; otherwise use 0 for the first chapter. Do not create chapters for greetings or filler.`,
  },
  core_concepts: {
    key: "core_concepts",
    instructions: `Regenerate the core concepts. Return JSON: { "core_concepts": [ { "term": "String", "definition": "String", "why_it_matters": "String", "example": "String" } ] }. 3 to 8 concepts central to the lecture. If an example cannot be safely created, use "Not explicitly provided in the transcript."`,
  },
  study_notes: {
    key: "study_notes",
    instructions: `Regenerate the study notes. Return JSON: { "study_notes": { "main_ideas": ["String"], "important_details": ["String"], "formulas_or_rules": ["String"], "processes_or_steps": ["String"], "comparisons": [{"concept_a":"String","concept_b":"String","difference":"String"}], "common_misunderstandings": ["String"], "exam_focus": ["String"] } }. Use empty arrays for anything not applicable.`,
  },
  quiz: {
    key: "quiz",
    instructions: `Regenerate the quiz. Return JSON: { "quiz": [ { "question": "String", "options": ["A","B","C","D"], "correctAnswer": "String matching one option exactly", "explanation": "String", "difficulty": "easy | medium | hard", "concept_tested": "String" } ] }. Exactly 5 multiple-choice questions, each with exactly 4 plausible distinct options. Difficulty distribution: 1 easy, 3 medium, 1 hard. Vary the questions from any previous version.`,
  },
  flashcards: {
    key: "flashcards",
    instructions: `Regenerate the flashcards. Return JSON: { "flashcards": [ { "front": "String", "back": "String", "category": "definition | formula | comparison | process | example | mistake" } ] }. 5 to 10 flashcards.`,
  },
  practice_tasks: {
    key: "practice_tasks",
    instructions: `Regenerate the practice tasks. Return JSON: { "practice_tasks": [ { "task": "String", "difficulty": "easy | medium | hard", "hint": "String", "solution": "String", "concepts_used": ["String"] } ] }. Exactly 3 tasks: one easy, one medium, one hard.`,
  },
  true_false_questions: {
    key: "true_false_questions",
    instructions: `Regenerate the true/false questions. Return JSON: { "true_false_questions": [ { "statement": "String", "answer": true, "explanation": "String" } ] }. Exactly 5 items, a mix of true and false, conceptual and non-trivial.`,
  },
  short_answer_questions: {
    key: "short_answer_questions",
    instructions: `Regenerate the short-answer questions. Return JSON: { "short_answer_questions": [ { "question": "String", "expected_answer": "String", "grading_hint": "String" } ] }. Exactly 3 items requiring explanation, not one-word answers.`,
  },
  glossary: {
    key: "glossary",
    instructions: `Regenerate the glossary. Return JSON: { "glossary": [ { "term": "String", "meaning": "String" } ] }. 5 to 12 important terms. If fewer than 5 meaningful terms exist, include only the available ones.`,
  },
  comprehensive_notes: {
    key: "comprehensive_notes",
    instructions: `Regenerate the comprehensive notes. Return JSON: { "comprehensive_notes": [ { "topic": "String", "explanation": "String", "formulas": [{"name":"String","formula":"String","variables":"String","when_to_use":"String","example":"String"}], "processes_or_algorithms": ["String"], "diagrams_or_tables_explained": ["String"], "code_explained": ["String"] } ] }. These are NOT a summary — explain every important topic, definition, process, formula, diagram, table and code snippet in enough depth for exam prep without reopening the source. One entry per major topic (3-10 entries), each explanation a short paragraph. Empty arrays for formulas/processes/diagrams/code that don't apply to a topic.`,
  },
  quick_review: {
    key: "quick_review",
    instructions: `Regenerate the quick review. Return JSON: { "quick_review": { "key_concepts": ["String"], "important_definitions": ["String"], "essential_formulas": ["String"], "exam_tips": ["String"], "common_mistakes": ["String"], "memory_tricks": ["String"] } }. A condensed last-minute-study version — short, punchy items, readable in under 10 minutes. Empty arrays for anything not applicable.`,
  },
  formula_sheet: {
    key: "formula_sheet",
    instructions: `Regenerate the formula sheet. Return JSON: { "formula_sheet": [ { "name": "String", "formula": "String", "variables": "String", "explanation": "String", "when_to_use": "String", "example": "String", "common_mistakes": "String", "related_formulas": ["String"] } ] }. Every formula in the material, deduplicated. Empty array if the material has no formulas.`,
  },
  definitions: {
    key: "definitions",
    instructions: `Regenerate the definitions. Return JSON: { "definitions": [ { "term": "String", "definition": "String", "simple_explanation": "String", "why_it_matters": "String", "related_concepts": ["String"] } ] }. Every important term, 5 to 15 entries, deeper than a glossary — full definition, a simpler one-sentence rephrasing, why it matters, and related concepts (empty array if none).`,
  },
  exam_focus: {
    key: "exam_focus",
    instructions: `Regenerate the exam focus. Return JSON: { "exam_focus": { "most_important_topics": ["String"], "frequently_tested_concepts": ["String"], "common_student_mistakes": ["String"], "high_priority_material": ["String"], "typical_exam_questions": ["String"] } }. Short phrases grounded in what the material emphasizes; typical_exam_questions should be 3-6 plausible exam-style questions (not full solutions).`,
  },
};

export function buildRegenerateSystemPrompt(section) {
  const spec = REGENERATABLE_SECTIONS[section];
  return `You are an expert AI assistant specializing in Educational Technology and Instructional Design, helping regenerate one part of an existing study package built from a lecture transcript.

${spec.instructions}

IMPORTANT OUTPUT RULES:
* Return only one valid JSON object with exactly the single top-level key described above.
* Do not include markdown formatting, code fences, comments, or trailing commas.
* All object keys and string values must use double quotes.
* The output must be entirely in English and grounded strictly in the provided transcript — do not invent facts.
* Return only the JSON object, nothing before or after it.`;
}

export function buildRegenerateUserMessage({ video_title, subject, transcript }) {
  return `Lecture Title: ${video_title || "Untitled Lecture"}
Subject/Course: ${subject || "General Academic"}

RAW TRANSCRIPT:
${transcript}`;
}

// --- Per-concept AI actions ----------------------------------------------

export const EXPLAIN_ACTIONS = {
  simpler: "Explain this concept in simpler terms than the original definition, for a student who found it confusing.",
  detail: "Give a more detailed, in-depth explanation of this concept, including nuance the original definition leaves out.",
  example: "Give one concrete real-world example that illustrates this concept clearly.",
  compare: "Compare this concept with the given related concept, focusing on the key differences and similarities.",
  practice: "Generate one new practice question (with its answer and a short explanation) that tests understanding of this concept.",
  analogy: "Generate one clear analogy that helps a student build intuition for this concept.",
  eli10: "Explain this concept the way you'd explain it to a curious 10-year-old — simple words, no jargon.",
};

export function buildExplainPrompt({ lectureTitle, lectureSummary, term, definition, action, compareWith }) {
  const instruction = EXPLAIN_ACTIONS[action];
  return `You are an AI tutor helping a student understand one concept from a lecture titled "${lectureTitle}".

Lecture context: ${lectureSummary || "N/A"}

Concept: ${term}
Current definition: ${definition || "N/A"}
${compareWith ? `Compare with: ${compareWith}` : ""}

Task: ${instruction}

Answer directly in 2-6 sentences (or as a short question+answer pair if generating a practice question). Do not repeat the original definition verbatim. Stay grounded in the lecture's subject matter — do not introduce unrelated topics. Plain text only, no markdown headers.`;
}
