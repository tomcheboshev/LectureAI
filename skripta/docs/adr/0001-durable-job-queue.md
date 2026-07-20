# ADR-0001: Durable Background Job Queue (BullMQ + Redis)

**Status:** Proposed
**Date:** 2026-07-19
**Deciders:** Engineering

## Context

Background study-package generation currently runs through `server/src/services/jobQueue.js`: a pure in-process array with a hand-rolled priority insertion (Pro jobs jump ahead of Free) and a concurrency cap (`CONCURRENCY = 2`). It's called from five sites in `routes/packages.js` — `generate`, `from-youtube`, `from-files`, and two `regenerate` paths.

This works, and the code is honest about its own limits (see the comments in `jobQueue.js` and `reconcileJobs.js`), but it has two real consequences:

1. **No durability.** A restart, deploy, or crash drops every in-flight job. `reconcileStrandedJobs()` runs on boot and marks any `StudyPackage` stuck in a non-terminal status as `failed` — a good user-facing fallback (no infinite spinner), but not a resume. If a chunked generation had completed 3 of 5 chunks before the crash, that AI spend is thrown away and the user starts over from zero.
2. **No multi-instance story.** The queue, and the concurrency limit it enforces, live in one process's memory. Running two API instances behind a load balancer means two independent queues with two independent concurrency caps (silently doubling real AI-provider concurrency) and no shared priority ordering between them. This is the harder constraint — it caps the app at one server instance, full stop.

## Decision

Replace the in-process array with **BullMQ backed by Redis**. Keep the shape of the existing call sites (`enqueue(job, { priority, meta })`) as close to unchanged as the boundary allows, to minimize the blast radius in `routes/packages.js`.

## Options Considered

### Option A: Keep in-process, add checkpointing
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | None |
| Scalability | Still single-instance — doesn't fix the real constraint |
| Team familiarity | High (no new tech) |

**Pros:** No new infra dependency.
**Cons:** Doesn't solve multi-instance concurrency governance or crash-mid-chunk durability. Papers over the problem rather than fixing it.

### Option B: BullMQ + Redis (recommended)
| Dimension | Assessment |
|---|---|
| Complexity | Medium — new dependency, call-site changes, idempotency work |
| Cost | Low (managed Redis is cheap; Upstash/Redis Cloud/Railway all have small-tier plans) |
| Scalability | Solves both problems: durable job state, shared concurrency/priority across N instances |
| Team familiarity | Medium — widely documented, closely mirrors the current priority-queue mental model |

**Pros:** Persisted job state survives restarts; built-in retries; per-worker concurrency is enforced centrally regardless of instance count; near drop-in replacement for `getQueueStatus()` via `Queue.getJobCounts()`.
**Cons:** New operational dependency (Redis uptime now gates generation); jobs must become serializable data instead of closures.

### Option C: Managed queue service (SQS + Lambda, or hosted queue like Upstash QStash)
| Dimension | Assessment |
|---|---|
| Complexity | Medium-High — implies splitting workers into a separate compute model |
| Cost | Low-Medium |
| Scalability | Good, but assumes a serverless/worker-split architecture this app doesn't have today |
| Team familiarity | Low |

**Pros:** No self-managed broker.
**Cons:** This app is a single long-lived Express process with a warm Mongo connection and AI provider client — a broker that plugs into the existing worker model (Option B) is a smaller, more natural change than restructuring around serverless workers.

## Trade-off Analysis

The in-process design's core assumption — one process, one memory space — is exactly what breaks under any real scaling need. BullMQ trades a small amount of new operational surface (Redis) for removing that ceiling entirely, and for free gets retry semantics that make "resume instead of restart" possible. The honest cost is that job payloads must be JSON-serializable; today's `enqueue()` calls already pass only primitives (`doc._id`, `req.userId`, plain option objects), so this is a small paper cut, not a redesign of the generation functions themselves.

The one piece of real new scope: retries are only *safe* once generation is idempotent. Today, a retried job would redo the entire chunked generation from scratch — wasteful but not incorrect. Making it skip already-completed chunks is valuable but is called out as a separate follow-up below rather than bundled into this migration.

## Consequences

- **Enables horizontal scaling** of the API/worker layer. Recommended follow-up beyond this ADR: split a dedicated `server/src/worker.js` entrypoint so deploying the API doesn't restart in-flight generation jobs, and vice versa.
- **Replaces "mark everything failed on boot"** with real per-job retry — fewer manual regenerations for users, less wasted AI spend.
- **New local dev dependency**: contributors need Redis running locally alongside MongoDB (docker-compose entry).
- **New env vars**: `REDIS_URL`, added to `.env.example` and the startup warning block in `index.js` (same pattern as the existing `OPENROUTER_API_KEY` check).

## Action Items

1. [ ] Add `bullmq` + `ioredis` to `server/package.json`; add `REDIS_URL` to `.env.example` and `index.js`'s startup env checks.
2. [ ] Add a `redis` service to local dev tooling (docker-compose or equivalent) and document it in the README setup steps.
3. [ ] Create `server/src/services/queue.js`: BullMQ `Queue` + `Worker` setup, concurrency from env (default 2, matching today's `CONCURRENCY`), priority mapping (Pro vs Free).
4. [ ] Convert the 5 `enqueue()` call sites in `routes/packages.js` to `queue.add(type, payload, { priority })`; move the "which `runXGeneration` function to call" dispatch into the Worker's processor.
5. [ ] Replace the boot-time `reconcileStrandedJobs()` sweep with a Worker `"failed"` event listener that marks a `StudyPackage` failed only once BullMQ's own retry budget is exhausted. Keep a narrow safety-net sweep only for the edge case where Redis itself was unreachable at boot.
6. [ ] Point the admin Processing Queue view (`routes/admin/system.js`) at `Queue.getJobCounts()` / `getJobs('active' | 'waiting')`.
7. [ ] **Follow-up (separate PR):** add per-chunk resume checkpoints in `ai/generation/chunkedGeneration.js` so a retried job skips chunks that already succeeded, instead of re-billing them.
8. [ ] Load-test with 2+ API/worker instances sharing one Redis instance to confirm the concurrency cap holds centrally, not per-instance.
