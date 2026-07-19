// Process-wide gate in front of every actual AI provider network call.
//
// A provider's own retry logic reacts to a 429 AFTER it happens. That's
// necessary (the provider's own limits can still be hit unpredictably) but
// insufficient on its own: nothing previously stopped this process from
// firing more requests per minute than the API key's plan actually allows in
// the first place. A single package generation is capped locally (jobQueue's
// CONCURRENCY, chunkedGeneration's CHUNK_CONCURRENCY), but those caps don't
// coordinate with each other — two users' generations running at once, or a
// generation running alongside chat/explain/regenerate calls, can together
// exceed the key's real per-minute budget even though no single piece of
// code looks like it's doing anything wrong.
//
// This limiter tracks a rolling 60s window of admitted requests and their
// estimated token cost, and makes every caller await a slot before the
// request goes out — queueing proactively instead of firing and hoping.
//
// OPENROUTER_RPM_LIMIT / OPENROUTER_TPM_LIMIT should be set to match the
// configured key's actual plan/model limits (see
// https://openrouter.ai/docs/limits). The defaults below are a conservative
// starting point for a free-tier key, not a guess at what this project's key
// actually has.
const RPM_LIMIT = Number(process.env.OPENROUTER_RPM_LIMIT) || 10;
const TPM_LIMIT = Number(process.env.OPENROUTER_TPM_LIMIT) || 250000;
const WINDOW_MS = 60000;

const requestTimestamps = []; // ms epoch, one entry per admitted request
const tokenUsage = []; // { at: ms epoch, tokens: estimated cost }

function pruneExpired(now) {
  while (requestTimestamps.length && now - requestTimestamps[0] > WINDOW_MS) requestTimestamps.shift();
  while (tokenUsage.length && now - tokenUsage[0].at > WINDOW_MS) tokenUsage.shift();
}

function currentTokenSum() {
  return tokenUsage.reduce((sum, e) => sum + e.tokens, 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function admit(estimatedTokens, label) {
  const cost = Math.max(0, Math.round(estimatedTokens) || 0);
  for (;;) {
    const now = Date.now();
    pruneExpired(now);
    const rpmOk = requestTimestamps.length < RPM_LIMIT;
    const projectedTokens = currentTokenSum() + cost;
    const tpmOk = projectedTokens <= TPM_LIMIT;

    if (rpmOk && tpmOk) {
      requestTimestamps.push(now);
      tokenUsage.push({ at: now, tokens: cost });
      return;
    }

    const nextRpmFree = requestTimestamps.length ? requestTimestamps[0] + WINDOW_MS - now : 1000;
    const nextTpmFree = tokenUsage.length ? tokenUsage[0].at + WINDOW_MS - now : 1000;
    const waitMs = Math.max(250, Math.min(!rpmOk ? nextRpmFree : Infinity, !tpmOk ? nextTpmFree : Infinity));
    console.log(
      `[ai-limiter] Throttling "${label}": ${
        !rpmOk ? `RPM budget full (${requestTimestamps.length}/${RPM_LIMIT} req/min)` : `TPM budget full (~${projectedTokens}/${TPM_LIMIT} est. tokens/min)`
      } — waiting ${waitMs}ms before admitting.`
    );
    await sleep(waitMs);
  }
}

// Callers are admitted strictly one at a time (including any wait) rather
// than racing each other against a shared snapshot — two concurrent callers
// both observing "under budget" from the same stale read and both getting
// admitted would defeat the whole point of this limiter. The cost is that a
// queued caller waits behind everyone ahead of it even once the budget would
// individually allow it sooner; acceptable given RPM_LIMIT is typically
// single digits to low tens, so the queue is short in practice.
let chain = Promise.resolve();

export function acquireRateLimitSlot(estimatedTokens, label = "AI request") {
  const task = chain.then(() => admit(estimatedTokens, label));
  chain = task.catch(() => {});
  return task;
}

// Read-only snapshot for logging/diagnostics — not currently surfaced in the
// admin panel, but cheap to expose if that becomes useful later.
export function getRateLimiterStatus() {
  const now = Date.now();
  pruneExpired(now);
  return {
    rpmLimit: RPM_LIMIT,
    tpmLimit: TPM_LIMIT,
    requestsInWindow: requestTimestamps.length,
    estimatedTokensInWindow: currentTokenSum(),
  };
}
