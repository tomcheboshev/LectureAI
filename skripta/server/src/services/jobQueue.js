// Minimal in-process priority queue for background study-package generation.
// Pro-plan jobs are inserted ahead of already-queued free-plan jobs — a
// real, working priority queue, just not a distributed one. It runs inside
// this Node process (concurrency-limited so we don't hammer the Gemini API),
// so a server restart drops any in-flight job; horizontal scaling across
// multiple server instances would need a real broker (BullMQ/Redis) instead.
const queue = [];
let running = 0;
const CONCURRENCY = 2;

export function enqueue(job, { priority = 0 } = {}) {
  const entry = { job, priority };
  const insertAt = queue.findIndex((e) => e.priority < priority);
  if (insertAt === -1) queue.push(entry);
  else queue.splice(insertAt, 0, entry);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const { job } = queue.shift();
    running++;
    Promise.resolve()
      .then(job)
      .catch((err) => console.error("Background job failed:", err))
      .finally(() => {
        running--;
        pump();
      });
  }
}
