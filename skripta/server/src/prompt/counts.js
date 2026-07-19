// Scales quiz/flashcard/practice/etc. counts to the material's size so a
// 3-page handout and a 60-page deck don't get asked for the same amount of
// content.

const COUNT_TIERS = [
  { maxChars: 3000, quiz: 4, flashcards: 5, practice: 2, trueFalse: 3, shortAnswer: 2, glossary: 5 },
  { maxChars: 8000, quiz: 6, flashcards: 8, practice: 3, trueFalse: 5, shortAnswer: 3, glossary: 7 },
  { maxChars: 18000, quiz: 9, flashcards: 11, practice: 4, trueFalse: 7, shortAnswer: 4, glossary: 9 },
  { maxChars: 35000, quiz: 12, flashcards: 15, practice: 5, trueFalse: 9, shortAnswer: 5, glossary: 12 },
  { maxChars: 70000, quiz: 16, flashcards: 20, practice: 6, trueFalse: 11, shortAnswer: 6, glossary: 15 },
  { maxChars: 150000, quiz: 20, flashcards: 25, practice: 7, trueFalse: 14, shortAnswer: 7, glossary: 18 },
  { maxChars: Infinity, quiz: 25, flashcards: 30, practice: 8, trueFalse: 16, shortAnswer: 8, glossary: 20 },
];

export function suggestedCounts(totalChars) {
  const n = Number(totalChars) || 0;
  const tier = COUNT_TIERS.find((t) => n <= t.maxChars) || COUNT_TIERS[COUNT_TIERS.length - 1];
  const { maxChars, ...counts } = tier;
  return counts;
}

export function targetCountsBlock(counts) {
  return `TARGET CONTENT COUNTS (PEDAGOGICALLY SCALED):
Generate exactly these counts to ensure an optimal cognitive load matching the material's depth:
- quiz: ${counts.quiz} conceptual/analytical multiple-choice questions
- flashcards: ${counts.flashcards} active-recall flashcards
- practice_tasks: ${counts.practice} applied practice tasks
- true_false_questions: ${counts.trueFalse} deep-misconception check items
- short_answer_questions: ${counts.shortAnswer} analytical short-answer questions
- glossary: up to ${counts.glossary} core technical terms`;
}
