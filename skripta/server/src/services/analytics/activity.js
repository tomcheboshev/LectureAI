import DailyActivity from "../../models/DailyActivity.js";

// UTC calendar days — a deliberate v1 simplification. Per-user local-timezone
// streaks would need an IANA timezone stored on User plus a date library;
// not built now.
export function todayKeyUTC(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function addDaysUTC(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Fire-and-forget: a rare failure here only undercounts one day of streak
// data, which self-heals on the next qualifying activity — not worth
// blocking or failing the caller's primary action (submitting a quiz
// attempt, reviewing a flashcard, etc.) over.
export async function recordActivity(ownerId, field, incBy = 1) {
  try {
    await DailyActivity.updateOne({ owner: ownerId, date: todayKeyUTC() }, { $inc: { [field]: incBy } }, { upsert: true });
  } catch (err) {
    console.error("recordActivity failed:", err);
  }
}

// "Qualifying activity" for a day = a DailyActivity document exists for that
// (owner, date) — documents are only ever upserted from a real event, so
// existence alone is sufficient; no need to inspect individual counters.
export async function computeStreak(ownerId) {
  const docs = await DailyActivity.find({ owner: ownerId }, "date").sort({ date: -1 }).limit(400).lean();
  const dates = new Set(docs.map((d) => d.date));

  let cursor = todayKeyUTC();
  if (!dates.has(cursor)) cursor = addDaysUTC(cursor, -1); // hasn't studied yet today doesn't zero the streak
  let current = 0;
  while (dates.has(cursor)) {
    current++;
    cursor = addDaysUTC(cursor, -1);
  }

  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && addDaysUTC(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest, lastActiveDate: sorted[sorted.length - 1] || null };
}
