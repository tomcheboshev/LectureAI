// ============================================================================
// AIProvider abstraction — every other file in ai/ talks to *this* module,
// never to a concrete provider client directly. Swapping providers (or
// adding a second one) is a one-line change to AI_PROVIDER, not an edit to
// every call site.
//
//   ai/generation/*, ai/pipeline/* --> getProvider() --> openrouter.js
//                                                     --> (future provider)
//
// Every entry in PROVIDERS must expose the same neutral surface:
//   chatComplete({system, messages, maxTokens, timeoutMs, responseFormat, label})
//   chatCompleteStream({...}, onDelta)
//   isConfigured()
//   getModel()
//   getFallbackModel()
// `messages` is always the neutral {role, text, images?} turn shape — no
// caller anywhere in ai/ constructs a provider-specific request body.
// ============================================================================

import * as openrouter from "./openrouter.js";

const PROVIDERS = {
  openrouter: {
    chatComplete: openrouter.chatComplete,
    chatCompleteStream: openrouter.chatCompleteStream,
    isConfigured: openrouter.isConfigured,
    getModel: openrouter.getConfiguredModel,
    getFallbackModel: openrouter.getFallbackModel,
  },
};

const PROVIDER_NAME = process.env.AI_PROVIDER || "openrouter";

export function getProvider() {
  const provider = PROVIDERS[PROVIDER_NAME];
  if (!provider) {
    throw new Error(`Unknown AI_PROVIDER "${PROVIDER_NAME}". Configured providers: ${Object.keys(PROVIDERS).join(", ")}.`);
  }
  return provider;
}

export function getProviderName() {
  return PROVIDER_NAME;
}
