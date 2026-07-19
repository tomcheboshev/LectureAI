// Barrel — the public surface exactly matches the old top-level prompt.js,
// so nothing outside this directory needs to know it's now split into
// counts/rules/examples/schema/builders internally.
export { suggestedCounts } from "./counts.js";
export {
  SYSTEM_PROMPT,
  buildUserMessage,
  buildSummaryChunkSystemPrompt,
  buildSummaryChunkUserMessage,
  buildSynthesisSystemPrompt,
  buildDistilledSummaryText,
  buildSynthesisUserMessage,
  MULTI_SOURCE_INSTRUCTIONS,
  REGENERATABLE_SECTIONS,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
  EXPLAIN_ACTIONS,
  buildExplainPrompt,
  buildChatSystemPrompt,
} from "./builders.js";
