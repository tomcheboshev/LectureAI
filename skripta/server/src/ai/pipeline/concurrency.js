// Shared bounded-concurrency runner — used by both chunkedGeneration.js
// (parallel per-source/per-chunk summary calls) and recoveryManager.js
// (parallel per-section recovery calls) so this isn't hand-duplicated in
// two places. Runs `worker(item, index)` over `items` with at most `limit`
// concurrently in flight — plain Promise.all would fire every item's call
// at once, which for a large multi-file upload (or a package with many
// simultaneously-failed sections) is a fast way to blow through the API
// key's per-minute rate limit before any of them finish.
export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
