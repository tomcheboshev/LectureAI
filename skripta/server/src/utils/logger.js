import ErrorLog from "../models/ErrorLog.js";

// Deliberate partial migration: this is wired into the global Express error
// handler plus the highest-value existing catch blocks (generation
// pipeline, webhook handlers, auth) — not a rewrite of every console.error
// call site in the app. Still console.errors too, so existing log-tailing
// workflows keep working.
export function logError(err, context) {
  console.error(err);
  ErrorLog.create({ level: "error", message: err?.message || String(err), stack: err?.stack, context: context || null }).catch((logErr) => {
    console.error("logError: failed to persist ErrorLog:", logErr);
  });
}
