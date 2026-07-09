// Every route's catch block funnels errors through here so the response
// shape is consistent: user-facing errors (validation, upgrade prompts,
// Gemini overload messages) show their real message; anything unexpected
// falls back to a generic message plus a server-side log, so internals
// never leak to the client.
export function respondError(res, err, fallbackMessage, fallbackStatus = 500) {
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id." });
  }

  const status = err?.status || fallbackStatus;
  const body = { error: err?.userFacing ? err.message : fallbackMessage };

  if (err?.upgradeRequired) {
    body.upgradeRequired = true;
    body.reason = err.reason;
    if (err.limit !== undefined) body.limit = err.limit;
    if (err.plan) body.plan = err.plan;
  }

  res.status(status).json(body);
}
