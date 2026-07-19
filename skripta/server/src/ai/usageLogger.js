import AiUsage from "../models/AiUsage.js";
import { estimateCostUsd } from "../services/analytics/pricing.js";

// Fire-and-forget usage logging — a logging failure must never fail the
// actual generation/chat call it's attached to. `response.model` is the
// model the provider actually served the request with, which can differ
// from the configured alias (e.g. an auto-router id routes to whichever
// underlying model is available) — logging the real served model is what
// makes cost/usage analytics meaningful.
export function logAiUsage(response, { ownerId, packageId, kind }) {
  if (!ownerId) return;
  const { promptTokens, completionTokens } = response?.usage || {};
  AiUsage.create({
    owner: ownerId,
    package: packageId,
    kind,
    model: response?.model,
    promptTokens,
    candidatesTokens: completionTokens,
    totalTokens: Number.isFinite(promptTokens) && Number.isFinite(completionTokens) ? promptTokens + completionTokens : undefined,
    estimatedCostUsd: estimateCostUsd({ model: response?.model, promptTokens, candidatesTokens: completionTokens }),
  }).catch((err) => console.error("AI usage log failed:", err));
}
