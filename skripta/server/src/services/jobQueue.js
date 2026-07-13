// Minimal in-process priority queue for background study-package generation.
// Pro-plan jobs are inserted ahead of already-queued free-plan jobs — a
// real, working priority queue, just not a distributed one. It runs inside
// this Node process (concurrency-limited so we don't hammer the Gemini API),
// so a server restart drops any in-flight job; horizontal scaling across
// multiple server instances would need a real broker (BullMQ/Redis) instead.
const queue = [];
const runningJobs = new Map(); // id -> { ...meta, enqueuedAt, startedAt }
let running = 0;
let nextId = 1;
const CONCURRENCY = 2;

// `meta` is optional, small, JSON-serializable context (ownerId, packageId,
// label) attached alongside the job for the admin Processing Queue view —
// the job itself stays an opaque closure, this is purely descriptive.
export function enqueue(job, { priority = 0, meta = null } = {}) {
  const entry = { id: nextId++, job, priority, meta, enqueuedAt: new Date() };
  const insertAt = queue.findIndex((e) => e.priority < priority);
  if (insertAt === -1) queue.push(entry);
  else queue.splice(insertAt, 0, entry);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const entry = queue.shift();
    runningJobs.set(entry.id, { ...entry.meta, priority: entry.priority, enqueuedAt: entry.enqueuedAt, startedAt: new Date() });
    running++;
    Promise.resolve()
      .then(entry.job)
      .catch((err) => console.error("Background job failed:", err))
      .finally(() => {
        runningJobs.delete(entry.id);
        running--;
        pump();
      });
  }
}

// Read-only snapshot for the admin Processing Queue view — not a
// job-mutation API (no cancel), since jobs are bare closures with no
// cancellation hook today.
export function getQueueStatus() {
  return {
    running,
    queued: queue.length,
    concurrency: CONCURRENCY,
    runningJobs: [...runningJobs.values()],
    queuedJobs: queue.map((e) => ({ ...e.meta, priority: e.priority, enqueuedAt: e.enqueuedAt })),
  };
}
