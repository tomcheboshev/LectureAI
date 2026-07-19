// JSON Validator + fallback parser stage — turns whatever text the provider
// returned into a real JS object, tolerating the ways a model's "JSON" can
// still be malformed even in JSON mode (raw newlines inside strings,
// unescaped LaTeX backslashes, a stray fence or trailing character, a
// response cut off mid-stream).

import { jsonrepair } from "jsonrepair";

// LaTeX (requested in prompts for formulas/math) is full of single
// backslashes — \delta, \times, \Sigma — which are invalid inside a JSON
// string unless doubled, and the model doesn't always escape them
// correctly. jsonrepair fixes most malformed-JSON issues (raw newlines,
// trailing commas, stray text around the object) but *drops* unrecognized
// escapes like "\S" rather than preserving them — which would silently
// mangle LaTeX commands. So we double any invalid backslash escape
// ourselves first (preserving the backslash), then hand the result to
// jsonrepair for everything else.
// A lookahead-only regex (matched one backslash at a time) can't tell "this
// is the second half of an already-valid \\ pair" from "this is a fresh
// stray backslash" — it re-examines the second backslash of a correctly
// escaped pair as if it were its own dangling backslash and doubles it
// again, turning a correct "\\log" (-> \log) into a corrupted "\\\log"
// (-> \\log, a literal double backslash that breaks LaTeX rendering).
// Matching each *complete* valid escape sequence as one atomic unit first
// (so the regex engine's match cursor jumps past both characters instead of
// re-visiting the second one) fixes that, while a lone invalid backslash —
// the actual case this function exists for — still falls through to the
// second alternative and gets doubled.
export function fixInvalidJsonEscapes(text) {
  return text.replace(/\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|\\/g, (match) => (match.length > 1 ? match : "\\\\"));
}

// Even in JSON mode, keep this extraction pass as a safety net — a
// truncated response can still arrive wrapped in a fence or with a stray
// trailing character, and not every model a provider can route to honors
// JSON mode equally strictly. Tracks string/escape state so a "{" or "}"
// inside a quoted string value doesn't miscount brace depth.
export function extractJsonSubstring(text) {
  // Anchored to the START and END of the whole response — NOT a bare
  // /```.../ search. The prompt asks the model to embed literal
  // ```mermaid ... ``` fenced code blocks as *string content* inside
  // "diagrams_or_tables_explained", and an unanchored regex matches that
  // first embedded fence pair instead of an actual outer wrapper, extracting
  // a few words from inside a string value as "the JSON" and discarding the
  // entire real response. Only strip a fence when it wraps the whole thing.
  const fenceMatch = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(text);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) return candidate.trim();

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  // Unbalanced — most likely a truncated response. Return everything from
  // the opening brace onward and let jsonrepair's own balancing close it.
  return candidate.slice(start);
}

export function extractJson(text) {
  console.log(`[pipeline] JSON validation: parsing ${text?.length || 0} char response...`);
  if (!text) throw new Error("The AI returned an empty response.");

  const jsonSubstring = extractJsonSubstring(text.trim());
  const cleaned = fixInvalidJsonEscapes(jsonSubstring);

  // Try the plain, un-repaired text first — jsonrepair is a safety net for
  // genuinely malformed JSON, not something that should run unconditionally
  // on every response; logging only when it was actually needed makes the
  // "JSON repaired" log line mean something instead of firing every time.
  try {
    const parsed = JSON.parse(cleaned);
    console.log("[pipeline] JSON validation: valid on first parse, no repair needed.");
    return parsed;
  } catch {
    // Fall through to jsonrepair below.
  }

  try {
    const repaired = jsonrepair(cleaned);
    const parsed = JSON.parse(repaired);
    console.log(`[pipeline] JSON repaired: jsonrepair fixed ${repaired.length !== cleaned.length ? "structural issues" : "formatting issues"} in the response.`);
    return parsed;
  } catch (err) {
    console.error(
      `[pipeline] JSON validation FAILED: ${err.message}\n--- RAW AI RESPONSE (${text.length} chars) ---\n${text}\n--- END RAW RESPONSE ---`
    );
    throw new Error(`The AI did not return valid JSON: ${err.message}`);
  }
}
