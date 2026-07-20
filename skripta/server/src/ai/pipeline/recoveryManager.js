// Recovery Manager — the pipeline's answer to "one bad section shouldn't
// force regenerating everything." For every section packageValidator.js
// marked invalid, this makes exactly ONE targeted single-section
// regeneration call, re-validates just that section's response, and merges
// it back into the package on success. A section that still fails after its
// recovery attempt is left at the safe empty value packageValidator already
// defaulted it to, and generation continues — EXCEPT "summary": a package
// with zero teaching content isn't a useful package, so an unrecoverable
// summary still fails the whole generation (matching the chunked
// generation path's existing "no usable chapters at all" precedent).
//
// SPEED: recovery attempts run CONCURRENTLY (bounded, via the shared
// runWithConcurrency), not one at a time — when several sections fail
// validation simultaneously (e.g. an entire half of the teaching/assessment
// split came back malformed), recovering them serially multiplied wall time
// by the number of failed sections; running them in parallel keeps recovery
// roughly as fast as its single slowest section.
//
// A genuine quota exhaustion during recovery stops every not-yet-started
// recovery attempt immediately (the same abortState short-circuit pattern
// used by chunked generation) rather than burning further calls against an
// account already known to be out of quota.

import { REGENERATABLE_SECTIONS } from "../../prompt/index.js";
import { regenerateSectionCore } from "../generation/sectionGeneration.js";
import { validateSectionValue } from "./packageValidator.js";
import { runWithConcurrency } from "./concurrency.js";

const RECOVERY_CONCURRENCY = 3;

export async function recoverInvalidSections({ pkg, sections, counts, video_title, subject, transcript, isMultiSource }, ctx = {}) {
  const failedSections = Object.entries(sections)
    .filter(([, s]) => !s.ok)
    .map(([name]) => name);

  if (failedSections.length === 0) return pkg;

  console.log(`[recovery] ${failedSections.length} section(s) need recovery: ${failedSections.map((s) => `${s} (${sections[s].reason})`).join("; ")}`);

  const abortState = { stopped: false, reason: null };

  const outcomes = await runWithConcurrency(failedSections, RECOVERY_CONCURRENCY, async (section) => {
    if (!REGENERATABLE_SECTIONS[section]) {
      console.warn(`[recovery] "${section}" has no regeneration path — leaving at its default value.`);
      return { section, recovered: false };
    }
    if (abortState.stopped) {
      console.warn(`[recovery] Skipping "${section}" — recovery already aborted (${abortState.reason}).`);
      return { section, recovered: false };
    }

    try {
      const { key, value } = await regenerateSectionCore({ section, counts, isMultiSource, video_title, subject, transcript }, ctx);
      const validated = validateSectionValue(section, value, counts);
      console.log(`[recovery] "${section}" recovered successfully.`);
      return { section, recovered: true, key, value: validated };
    } catch (err) {
      console.warn(`[recovery] "${section}" recovery attempt failed: ${err.message}`);
      if (err.quotaExhausted) {
        abortState.stopped = true;
        abortState.reason = err.message;
      }
      return { section, recovered: false };
    }
  });

  for (const outcome of outcomes) {
    if (outcome.recovered) {
      pkg[outcome.key] = outcome.value;
      continue;
    }
    if (outcome.section === "summary") {
      throw Object.assign(
        new Error(`Could not generate usable content for this material, even after a recovery attempt${abortState.reason ? `: ${abortState.reason}` : "."}`),
        { userFacing: true }
      );
    }
    console.warn(`[recovery] "${outcome.section}" left at its safe default value — generation continues.`);
  }

  return pkg;
}
