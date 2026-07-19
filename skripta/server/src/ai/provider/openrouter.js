// ============================================================================
// OpenRouter provider client — a single, provider-neutral chat-completions
// client (streaming + non-streaming, retry, timeout, JSON mode, image
// inputs, centralized error handling, usage/latency/model logging) that the
// rest of the app talks to instead of any one AI vendor's SDK. Everything
// here is plain `fetch` against OpenRouter's OpenAI-compatible REST API
// (https://openrouter.ai/docs/api-reference/chat-completion) — no vendor
// SDK dependency. The generic pieces (HTTP status classification,
// retry-with-backoff, token estimation) are exported on their own so a
// future provider (e.g. a direct OpenAI or Anthropic client) can reuse them
// instead of re-implementing the same retry/error logic.
// ============================================================================

const BASE_URL = "https://openrouter.ai/api/v1";

const API_KEY = process.env.OPENROUTER_API_KEY;

// Deliberately NOT "openrouter/free" — that id is OpenRouter's auto-router,
// which randomly selects a different underlying free model per request
// (announced Feb 2026). Model quality/speed/parameter-support then varies
// call to call, which is exactly what was producing unpredictable 300s
// timeouts: a request could land on a slow or overloaded model with no way
// to tell which one until it already hung. A single, specific, pinned model
// id has consistent latency and capability. Both the primary and fallback
// are configurable via .env — these code-level values are only the
// out-of-the-box default, not something callers should rely on staying the
// same. Verified live against GET /api/v1/models (not guessed): both
// support "response_format" (every generation call requests JSON mode) and
// image input (embedded diagrams are sent as inline images) — a model
// missing either would silently degrade output quality or reject requests
// outright once `provider.require_parameters` is set below. Free-tier
// model availability rotates on OpenRouter's end; re-check
// https://openrouter.ai/models before assuming these stay valid forever.
const MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemma-4-31b-it:free";

// Sent per OpenRouter's own documented convention — used for their public
// rankings/analytics, not required for the API to function. Harmless if
// CLIENT_URL is unset.
const APP_REFERER = process.env.CLIENT_URL || "http://localhost:5173";
const APP_TITLE = "LectureAI";

export function getConfiguredModel() {
  return MODEL;
}

export function getFallbackModel() {
  return FALLBACK_MODEL;
}

export function isConfigured() {
  return Boolean(API_KEY);
}

// ----------------------------------------------------------------------------
// REUSABLE HELPERS — generic enough to be lifted into a future
// provider/<otherProvider>.js without change.
// ----------------------------------------------------------------------------

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rough, deliberately conservative token estimate (~4 chars/token, the
// standard rule-of-thumb for English/code text) used only for local
// rate-limiter budgeting and diagnostic logging — the authoritative figure
// is always the `usage` object a completed response reports back.
export function estimateTokensFromChars(charCount) {
  return Math.ceil((Number(charCount) || 0) / 4);
}

// A 429 (rate limit) can mean two very different things: a per-minute limit
// that clears on its own in seconds, or the account being genuinely out of
// credits/quota, which retrying can never fix. OpenRouter and the models it
// proxies don't use one consistent error code for the second case, so this
// checks both the handful of machine-readable codes that do exist and the
// message text as a fallback.
function isQuotaExhaustion(status, body) {
  if (status !== 429 && status !== 402) return false;
  const code = String(body?.error?.code || "").toLowerCase();
  const message = String(body?.error?.message || "").toLowerCase();
  if (code.includes("insufficient_quota") || code.includes("insufficient_credits") || code === "402") return true;
  return /credit|quota|balance|insufficient.{0,10}(funds|credits)/i.test(message);
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const FRIENDLY_MESSAGES = {
  400: "The request sent to the AI model was malformed. This is likely a bug — please report it.",
  401: "The AI service's API key is invalid or missing. Check the server's OPENROUTER_API_KEY configuration.",
  402: "The AI service requires additional credits to continue. Add credits at https://openrouter.ai/credits, then try again.",
  403: "The AI service's API key doesn't have permission for this model.",
  404: "The configured model was not found on OpenRouter. Check the server's OPENROUTER_MODEL configuration.",
  413: "This request was too large for the AI model to process, even after splitting. Please try a smaller file.",
  429: "The AI model hit a rate limit. Please wait a moment and try again.",
  500: "The AI service is temporarily unavailable. Please try again shortly.",
  502: "The AI service's upstream model is temporarily unavailable. Please try again shortly.",
  503: "The AI model is currently overloaded with requests. Please try again in a minute.",
  504: "The AI service timed out upstream. Please try again shortly.",
};

// Generic "call this, retry transient failures, give up on permanent ones"
// wrapper — not specific to OpenRouter's request shape, just its error
// classification. `retries` is additional attempts beyond the first (the
// default of 1 means 2 total attempts): a genuine transient blip usually
// clears on the very next try; anything that doesn't is far more likely a
// real, non-transient problem that a 3rd/4th/5th identical attempt will not
// fix, it will only burn more of the account's rate-limit/quota budget.
// A timeout (no HTTP status at all — the request never got a response) is
// NEVER retried here: retrying the exact same model that just took longer
// than `timeoutMs` to answer is unlikely to be fast the second time either.
// That case is handled one level up, by chatComplete falling back to a
// DIFFERENT model instead of repeating this one.
export async function withRetry(fn, { retries = 1, baseDelayMs = 2000, label = "AI request" } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;

      if (err.permanent || err.timedOut) {
        console.error(`[openrouter] ${label} failed permanently (attempt ${attempt + 1}/${retries + 1}): ${err.message} — not retrying.`);
        break;
      }
      if (!RETRYABLE_STATUSES.has(err.status) || attempt === retries) {
        console.error(`[openrouter] ${label} failed (status ${err.status}, attempt ${attempt + 1}/${retries + 1}): ${err.message} — giving up.`);
        break;
      }

      const delay = Number.isFinite(err.retryAfterMs) ? Math.min(err.retryAfterMs, 60000) : baseDelayMs * 2 ** attempt;
      const reason = Number.isFinite(err.retryAfterMs) ? "honoring the API's Retry-After header" : "exponential backoff";
      console.warn(`[openrouter] ${label} failed (status ${err.status}): ${err.message} — retrying in ${delay}ms (${reason}, attempt ${attempt + 1}/${retries})...`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

// ----------------------------------------------------------------------------
// Request/response shape conversion — the only OpenRouter-specific part.
// Everything else in this file (and every caller) works with the neutral
// {role, text, images?} "turn" shape and the neutral response shape below.
// ----------------------------------------------------------------------------

function turnToMessage({ role, text, images }) {
  if (!images?.length) return { role, content: text };
  return {
    role,
    content: [
      { type: "text", text },
      ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
    ],
  };
}

// https://openrouter.ai/docs/api-reference/chat-completion — `model`,
// `messages`, `max_tokens`, `stream`, and `response_format` are the
// documented request fields this app needs. `provider.require_parameters`
// restricts routing to providers that actually support every parameter in
// this request (notably `response_format`) — without it, OpenRouter can
// silently route a JSON-mode request to a provider that ignores
// response_format entirely, which produces prose instead of JSON rather
// than an error, and was a second, independent source of unreliable output
// alongside the auto-router model-selection problem.
function buildRequestBody({ model, system, messages, maxTokens, responseFormat, stream }) {
  const chatMessages = [...(system ? [{ role: "system", content: system }] : []), ...messages.map(turnToMessage)];
  return {
    model,
    messages: chatMessages,
    max_tokens: maxTokens,
    stream: Boolean(stream),
    ...(responseFormat === "json" ? { response_format: { type: "json_object" }, provider: { require_parameters: true } } : {}),
  };
}

// OpenRouter normalizes finish_reason to: stop, length, content_filter,
// tool_calls, error (see docs) — "length" (hit max_tokens) and
// "content_filter" (safety block) are the two values calling code needs to
// react to specially. `native_finish_reason` (the raw, provider-specific
// value) is kept alongside for logging since it's often more informative
// for debugging a specific model's behavior.
function normalizeFinishReason(raw) {
  return raw || "stop";
}

async function parseErrorBody(res) {
  try {
    return await res.json();
  } catch {
    try {
      return { error: { message: await res.text() } };
    } catch {
      return { error: { message: res.statusText || "Unknown error" } };
    }
  }
}

async function throwForResponse(res) {
  const body = await parseErrorBody(res);
  const status = res.status;
  const message = body?.error?.message || `HTTP ${status}`;

  if (isQuotaExhaustion(status, body)) {
    const e = new Error("AI quota temporarily exhausted. Please try again later.");
    e.status = status;
    e.userFacing = true;
    e.permanent = true;
    e.quotaExhausted = true;
    throw e;
  }

  const friendly = FRIENDLY_MESSAGES[status];
  const e = new Error(friendly || message);
  e.status = status;
  e.rawMessage = message;
  if (friendly) e.userFacing = true;
  if (!RETRYABLE_STATUSES.has(status)) e.permanent = true;
  const retryAfterHeader = res.headers.get("retry-after");
  const retryAfterSecs = parseFloat(retryAfterHeader || "");
  if (Number.isFinite(retryAfterSecs)) e.retryAfterMs = retryAfterSecs * 1000;
  throw e;
}

function requestHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": APP_REFERER,
    "X-Title": APP_TITLE,
  };
}

// Turns a plain "the call took too long" situation into an ACTUALLY
// cancelled request. The previous implementation raced the fetch against a
// separate timer (via a generic withTimeout helper) — that reports failure
// to the caller when the timer wins, but never touches the underlying
// connection, so the real HTTP request keeps running in the background
// until the model eventually answers or the OS/undici's own (much longer,
// or absent) socket timeout kicks in. AbortSignal.timeout() ties an actual
// abort to the fetch itself, so a "timeout" here means the connection is
// really torn down, not just ignored. Node/undici surfaces this as a
// DOMException named "TimeoutError", which is how the caller distinguishes
// "this attempt timed out" from every other failure mode.
async function fetchJson(url, body, timeoutMs) {
  try {
    const res = await fetch(url, { method: "POST", headers: requestHeaders(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) await throwForResponse(res);
    return await res.json();
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      const e = new Error(`The AI service did not respond within ${Math.round(timeoutMs / 1000)}s.`);
      e.timedOut = true;
      e.userFacing = true;
      throw e;
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// CORE: non-streaming chat completion.
// ----------------------------------------------------------------------------

async function attemptModel(model, { system, messages, maxTokens, timeoutMs, responseFormat, label }) {
  const body = buildRequestBody({ model, system, messages, maxTokens, responseFormat, stream: false });
  const payloadChars = JSON.stringify(body).length;
  console.log(`[openrouter] ${label}: model=${model} maxTokens=${maxTokens} payloadChars=${payloadChars}`);

  const startedAt = Date.now();
  const data = await withRetry(() => fetchJson(`${BASE_URL}/chat/completions`, body, timeoutMs), { retries: 1, label });
  const durationMs = Date.now() - startedAt;

  const choice = data.choices?.[0];
  const text = choice?.message?.content || "";
  const finishReason = normalizeFinishReason(choice?.finish_reason);
  const usage = {
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    totalTokens: data.usage?.total_tokens,
  };
  const servedModel = data.model || model;
  // Confirmed live (not assumed from docs) that OpenRouter's chat completion
  // body does include a top-level "provider" field naming the actual
  // upstream inference provider that served the request (e.g. "Darkbloom",
  // "Google AI Studio") — genuinely more useful than the model id's org
  // slug, since one model can be served by several different providers.
  // Fall back to deriving from the model id only on the off chance a
  // response is missing it.
  const provider = data.provider || servedModel.split("/")[0];

  console.log(
    `[openrouter] ${label} done: model=${servedModel} provider=${provider} durationMs=${durationMs} finishReason=${finishReason} nativeFinishReason=${choice?.native_finish_reason || "n/a"} inputTokens=${usage.promptTokens ?? "?"} outputTokens=${usage.completionTokens ?? "?"} totalTokens=${usage.totalTokens ?? "?"}`
  );

  return { text, finishReason, usage, model: servedModel, provider, durationMs };
}

/**
 * @param {object} opts
 * @param {string} [opts.system] - system prompt.
 * @param {Array<{role: "user"|"assistant", text: string, images?: Array<{mimeType:string, base64:string}>}>} opts.messages
 * @param {number} opts.maxTokens
 * @param {number} [opts.timeoutMs]
 * @param {"json"} [opts.responseFormat] - request JSON-mode output.
 * @param {string} [opts.label] - for logging.
 * @returns {Promise<{text: string, finishReason: string, usage: {promptTokens:number, completionTokens:number, totalTokens:number}, model: string, provider: string, durationMs: number}>}
 */
export async function chatComplete({ system, messages, maxTokens, timeoutMs = 120000, responseFormat, label = "AI request" } = {}) {
  if (!API_KEY) {
    const e = new Error("The AI service's API key is invalid or missing. Check the server's OPENROUTER_API_KEY configuration.");
    e.userFacing = true;
    e.permanent = true;
    throw e;
  }

  const callOpts = { system, messages, maxTokens, timeoutMs, responseFormat, label };
  try {
    return await attemptModel(MODEL, callOpts);
  } catch (err) {
    // Automatic model fallback: ONLY on a timeout, and only once, against a
    // different configured model — a 4xx/permanent error would fail
    // identically on any model (retrying with a different one wouldn't
    // help), and a transient 5xx/429 already got its own retry against the
    // same model inside attemptModel/withRetry above.
    if (err.timedOut && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
      console.warn(`[openrouter] ${label} timed out on primary model "${MODEL}" after ${timeoutMs}ms — retrying once with fallback model "${FALLBACK_MODEL}".`);
      return attemptModel(FALLBACK_MODEL, callOpts);
    }
    throw err;
  }
}

// ----------------------------------------------------------------------------
// Streaming variant — same neutral response shape once the stream
// completes, plus an optional per-token callback for live consumption.
// Not currently wired into any generation call site (this app's generation
// pipeline is a polling background job, not a live connection), but kept as
// a first-class capability since a future feature (e.g. live chat replies)
// can use it as-is.
// ----------------------------------------------------------------------------

async function streamModel(model, { system, messages, maxTokens, timeoutMs, label }, onDelta) {
  const body = buildRequestBody({ model, system, messages, maxTokens, stream: true });
  console.log(`[openrouter] ${label} (streaming): model=${model} maxTokens=${maxTokens}`);

  const startedAt = Date.now();
  const result = await withRetry(
    () =>
      (async () => {
        let res;
        try {
          res = await fetch(`${BASE_URL}/chat/completions`, { method: "POST", headers: requestHeaders(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
        } catch (err) {
          if (err.name === "TimeoutError" || err.name === "AbortError") {
            const e = new Error(`The AI service did not respond within ${Math.round(timeoutMs / 1000)}s.`);
            e.timedOut = true;
            e.userFacing = true;
            throw e;
          }
          throw err;
        }
        if (!res.ok) await throwForResponse(res);

        let text = "";
        let finishReason = "stop";
        let usage = { promptTokens: undefined, completionTokens: undefined, totalTokens: undefined };
        let servedModel = model;
        let servedProvider = null;
        let buffered = "";

        for await (const chunk of res.body) {
          buffered += Buffer.isBuffer(chunk) ? chunk.toString("utf-8") : chunk;
          const lines = buffered.split("\n");
          buffered = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            // SSE comment lines (leading ":") are a documented keep-alive
            // OpenRouter sends periodically — not data, safe to ignore
            // alongside anything else that isn't a "data:" line.
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            let event;
            try {
              event = JSON.parse(payload);
            } catch {
              continue;
            }
            servedModel = event.model || servedModel;
            servedProvider = event.provider || servedProvider;
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
              text += delta;
              onDelta?.(delta);
            }
            if (event.choices?.[0]?.finish_reason) finishReason = normalizeFinishReason(event.choices[0].finish_reason);
            if (event.usage) {
              usage = {
                promptTokens: event.usage.prompt_tokens,
                completionTokens: event.usage.completion_tokens,
                totalTokens: event.usage.total_tokens,
              };
            }
          }
        }

        return { text, finishReason, usage, model: servedModel, provider: servedProvider };
      })(),
    { retries: 1, label }
  );
  const durationMs = Date.now() - startedAt;
  const provider = result.provider || result.model.split("/")[0];

  console.log(
    `[openrouter] ${label} done (streaming): model=${result.model} provider=${provider} durationMs=${durationMs} finishReason=${result.finishReason} inputTokens=${result.usage.promptTokens ?? "?"} outputTokens=${result.usage.completionTokens ?? "?"} totalTokens=${result.usage.totalTokens ?? "?"}`
  );

  return { ...result, provider, durationMs };
}

/**
 * @param {object} opts - same as chatComplete, minus `responseFormat` (OpenRouter's
 *   JSON mode and streaming aren't reliably combinable across every routed model).
 * @param {(deltaText: string) => void} [onDelta] - called once per streamed token/chunk.
 * @returns {Promise<{text: string, finishReason: string, usage: object, model: string, provider: string, durationMs: number}>}
 */
export async function chatCompleteStream({ system, messages, maxTokens, timeoutMs = 120000, label = "AI streaming request" } = {}, onDelta) {
  if (!API_KEY) {
    const e = new Error("The AI service's API key is invalid or missing. Check the server's OPENROUTER_API_KEY configuration.");
    e.userFacing = true;
    e.permanent = true;
    throw e;
  }

  const callOpts = { system, messages, maxTokens, timeoutMs, label };
  try {
    return await streamModel(MODEL, callOpts, onDelta);
  } catch (err) {
    if (err.timedOut && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
      console.warn(`[openrouter] ${label} timed out on primary model "${MODEL}" after ${timeoutMs}ms — retrying once with fallback model "${FALLBACK_MODEL}".`);
      return streamModel(FALLBACK_MODEL, callOpts, onDelta);
    }
    throw err;
  }
}
