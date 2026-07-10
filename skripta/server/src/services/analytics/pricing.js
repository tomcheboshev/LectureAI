// Best-effort, clearly-labeled-as-an-estimate cost table — not billing-grade.
// Prices are USD per 1M tokens and will drift out of date; unrecognized
// models return null rather than a silently wrong number.
const PRICING_PER_MILLION_TOKENS = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

export function estimateCostUsd({ model, promptTokens, candidatesTokens }) {
  const rates = PRICING_PER_MILLION_TOKENS[model];
  if (!rates || !Number.isFinite(promptTokens) || !Number.isFinite(candidatesTokens)) return null;
  return (promptTokens / 1e6) * rates.input + (candidatesTokens / 1e6) * rates.output;
}
