// ----------------------------------------------------------------------------
// SECTION: JSON SCHEMA — prose structure fragments
// Each field's shape is defined exactly once and composed per mode: chunk =
// summary + transcription_corrections only; synthesis = everything except
// those two; full = all of them, in this order. Previously these three
// prose blocks were hand-duplicated/hand-split with no shared source.
// ----------------------------------------------------------------------------

export const CHAPTER_CORE_FIELDS = `"topic_title": "String",
      "description": "String — Comprehensive, textbook-quality explanation detailing the theoretical foundation, mechanics, and operational rules of this topic.",
      "formulas": [
        { "name": "String", "formula": "String (Escaped LaTeX)", "variables": "String", "when_to_use": "String", "example": "String (fully worked, step-by-step numeric computation — not just the final answer)" }
      ],
      "algorithms_or_processes": ["String (Step-by-step sequential breakdowns)"],
      "diagrams_or_tables_explained": [
        "String (If an automaton/machine is described, provide a markdown transition table AND a clean valid Mermaid.js graph code block wrapped in \`\`\`mermaid so the web app can render it visually)"
      ],
      "code_explained": ["String (Logic, invariants, edge cases, time/space complexity)"],
      "examples": ["String (Thoroughly worked academic examples or fully decomposed problems from the slides)"],
      "key_points": ["String (Core conceptual takeaways)"],
      "images": [
        { "id": "String (EXACTLY one of the IMG ids listed in the AVAILABLE IMAGES manifest below — never invent an id)", "caption": "String (What the image literally shows, one sentence)", "explanation": "String (Why this image matters here and what it teaches — connect it to the surrounding chapter content)" }
      ]`;

export const JSON_FIELD = {
  metadata: `"metadata": {
    "video_title": "String",
    "subject": "String",
    "estimated_level": "beginner | intermediate | advanced",
    "estimated_duration_minutes": 0,
    "content_type": "lecture | tutorial | explanation | problem_solving | mixed",
    "language_detected": "String",
    "transcript_quality": "high | medium | low",
    "short_description": "String (High-impact learning hook)"
  }`,

  study_scaffolding: `"study_scaffolding": {
    "mental_model_anchor": "String (One-sentence powerful analogy serving as an intuitive anchor for the core theme)",
    "cognitive_roadmap": ["String (Logical progression steps to master this topic, from baseline to advanced concepts)"],
    "retention_strategy": "String (Specific active recall strategy tailored for this subject, e.g., 'Trace the memory stack on paper')"
  }`,

  summary_full: `"summary": [
    {
      "source_index": 0,
      "source_title": "String or null",
      "timestamp": 0,
      ${CHAPTER_CORE_FIELDS}
    }
  ]`,

  summary_chunk: `"summary": [
    {
      ${CHAPTER_CORE_FIELDS}
    }
  ]`,

  edge_cases_and_limits: `"edge_cases_and_limits": [
    {
      "scenario": "String (Description of a boundary condition, empty input, overflow, or extreme value)",
      "behavior": "String (How the system/algorithm/formula handles or breaks under this scenario)",
      "fix_or_mitigation": "String (The engineering or theoretical solution to handle this edge case safely)"
    }
  ]`,

  full_lecture_summary: `"full_lecture_summary": "String (100-200 words synthesizing the overarching narrative and academic utility of the lesson)"`,

  core_concepts: `"core_concepts": [
    {
      "term": "String",
      "definition": "String (Precise, clear definition)",
      "why_it_matters": "String (The structural role this concept plays in the broader subject)",
      "related_concepts": ["String"],
      "common_mistakes": "String (Typical exam trap or cognitive slip when solving tasks)",
      "example": "String"
    }
  ]`,

  study_notes: `"study_notes": {
    "main_ideas": ["String"],
    "important_details": ["String"],
    "formulas_or_rules": ["String"],
    "processes_or_steps": ["String"],
    "comparisons": [
      { "concept_a": "String", "concept_b": "String", "difference": "String (High-contrast differentiation)" }
    ],
    "common_misunderstandings": ["String"],
    "exam_focus": ["String (High-probability assessment vectors and problem types)"]
  }`,

  quiz: `"quiz": [
    {
      "question": "String",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "String (Must exactly match one of the options)",
      "explanation": "String (Detailed rationale explaining why the option is correct AND why the main distractors are incorrect)",
      "difficulty": "easy | medium | hard",
      "concept_tested": "String"
    }
  ]`,

  flashcards: `"flashcards": [
    {
      "front": "String (Question or prompt forcing active recall)",
      "back": "String (Targeted, concise diagnostic answer)",
      "category": "definition | formula | comparison | process | example | mistake",
      "prompt_type": "cloze_deletion | QA | structural_fill",
      "retention_hint": "String (Mnemonic device or short trick to anchor this specific fact permanently)"
    }
  ]`,

  practice_tasks: `"practice_tasks": [
    {
      "task": "String (Applied, algorithmic, or numerical problem extracted or adapted directly from the lecture material)",
      "difficulty": "easy | medium | hard",
      "hint": "String (Scaffolding hint focused on the first step)",
      "solution": "String (Complete step-by-step mathematical or structural derivation/implementation, embedding Mermaid code syntax for states if applicable)",
      "concepts_used": ["String"]
    }
  ]`,

  true_false_questions: `"true_false_questions": [
    {
      "statement": "String (A plausible but distinct statement specifically testing conceptual precision)",
      "answer": true,
      "explanation": "String"
    }
  ]`,

  short_answer_questions: `"short_answer_questions": [
    {
      "question": "String (Requires synthesis or analytical reasoning)",
      "expected_answer": "String",
      "grading_hint": "String (Rubric or key keywords that MUST be present for full credit)"
    }
  ]`,

  glossary: `"glossary": [
    { "term": "String", "meaning": "String" }
  ]`,

  learning_path: `"learning_objectives": ["String (Must begin with measurable Bloom's Taxonomy verbs: Design, Analyze, Evaluate, Solve...)"],
  "prerequisites": ["String"],
  "recommended_next_steps": ["String"]`,

  transcription_corrections: `"transcription_corrections": [
    { "original": "String (the mis-transcribed word/phrase as it appeared in the source)", "corrected": "String (the corrected technical term you used instead)" }
  ]`,

  chatbot_context: `"chatbot_context": {
    "lecture_overview": "String",
    "key_takeaways": ["String", "String", "String"],
    "important_terms": ["String"],
    "rules_formulas_or_methods": ["String"],
    "student_confusion_points": ["String (Where students usually get stuck when solving problems based on this layout)"],
    "suggested_student_prompts": ["String", "String", "String"]
  }`,
};

export const FULL_JSON_STRUCTURE = `{
  ${JSON_FIELD.metadata},
  ${JSON_FIELD.study_scaffolding},
  ${JSON_FIELD.summary_full},
  ${JSON_FIELD.edge_cases_and_limits},
  ${JSON_FIELD.full_lecture_summary},
  ${JSON_FIELD.core_concepts},
  ${JSON_FIELD.study_notes},
  ${JSON_FIELD.quiz},
  ${JSON_FIELD.flashcards},
  ${JSON_FIELD.practice_tasks},
  ${JSON_FIELD.true_false_questions},
  ${JSON_FIELD.short_answer_questions},
  ${JSON_FIELD.glossary},
  ${JSON_FIELD.learning_path},
  ${JSON_FIELD.transcription_corrections},
  ${JSON_FIELD.chatbot_context}
}`;

export const CHUNK_JSON_STRUCTURE = `Return ONLY this JSON object — nothing else, no other top-level keys:
{
  ${JSON_FIELD.summary_chunk},
  ${JSON_FIELD.transcription_corrections}
}`;

export const SYNTHESIS_JSON_STRUCTURE = `Return ONLY this JSON object:
{
  ${JSON_FIELD.metadata},
  ${JSON_FIELD.study_scaffolding},
  ${JSON_FIELD.edge_cases_and_limits},
  ${JSON_FIELD.full_lecture_summary},
  ${JSON_FIELD.core_concepts},
  ${JSON_FIELD.study_notes},
  ${JSON_FIELD.quiz},
  ${JSON_FIELD.flashcards},
  ${JSON_FIELD.practice_tasks},
  ${JSON_FIELD.true_false_questions},
  ${JSON_FIELD.short_answer_questions},
  ${JSON_FIELD.glossary},
  ${JSON_FIELD.learning_path},
  ${JSON_FIELD.chatbot_context}
}`;
