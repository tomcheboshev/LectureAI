import StudyPackage from "../models/StudyPackage.js";

// jobQueue.js is a pure in-process array — a server restart drops every
// in-flight background job with no state to resume from (see its own
// comment). Left alone, any StudyPackage stuck in a non-terminal status from
// before the restart would poll forever on the frontend (StudyPackagePage.vue
// keeps polling while status is queued/extracting/generating/saving) since
// nothing will ever move it forward again. Mark them failed with a clear,
// honest message so the user knows to retry, instead of a silent hang.
//
// Single-instance caveat: this assumes one server process owns the whole
// queue. If this ever runs behind a load balancer with multiple instances,
// this blanket "mark stranded as failed" would also kill jobs genuinely
// in-flight on a *different*, still-running instance — it would need to be
// scoped by a worker/instance id first.
export async function reconcileStrandedJobs() {
  const result = await StudyPackage.updateMany(
    { status: { $in: ["queued", "extracting", "generating", "saving"] } },
    {
      status: "failed",
      progress: 0,
      generationError: "Generation was interrupted by a server restart. Please try again.",
    }
  );
  if (result.modifiedCount) {
    console.warn(`Reconciled ${result.modifiedCount} stranded generation job(s) from a previous run.`);
  }
}
