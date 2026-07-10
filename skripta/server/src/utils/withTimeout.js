// Wraps a promise so a hung network call fails fast instead of occupying a
// job-queue slot indefinitely (the background job queue has only 2
// concurrency slots — a single stuck Gemini call could otherwise stall
// generation for every user on the server).
export function withTimeout(promise, ms, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.timeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
