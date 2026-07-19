// Best-effort, clearly-labeled-as-an-estimate cost table — not billing-grade.
// Prices are USD per 1M tokens and will drift out of date; unrecognized
// models return null rather than a silently wrong number. OpenRouter's own
// per-model pricing (https://openrouter.ai/models) is the source of truth
// and can change at any time — this table only covers the configured
// default ("openrouter/free", genuinely $0) plus a couple of common paid
// aliases; add an entry here if a different OPENROUTER_MODEL is configured
// and cost visibility matters.
const PRICING_PER_MILLION_TOKENS = {
  "openrouter/free": { input: 0, output: 0 },
};

export function estimateCostUsd({ model, promptTokens, candidatesTokens }) {
  const rates = PRICING_PER_MILLION_TOKENS[model];
  if (!rates || !Number.isFinite(promptTokens) || !Number.isFinite(candidatesTokens)) return null;
  return (promptTokens / 1e6) * rates.input + (candidatesTokens / 1e6) * rates.output;
}
