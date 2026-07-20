# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in `server/` (the
LectureAI backend). Read together with the root [`../CLAUDE.md`](../CLAUDE.md), which covers the project as
a whole and isn't repeated here.

## Purpose

An Express/MongoDB API responsible for: auth (JWT + OAuth), the file-upload → AI-generation pipeline,
Stripe billing, transactional email, and the admin/analytics surface. It is the only thing that talks to
MongoDB, Stripe, OpenRouter, and Resend — the frontend never calls any of those directly.

## Commands

```
npm run dev      # node --watch src/index.js — restarts on file change
npm run start    # node src/index.js — no watch, for production
```

There is no test runner, linter, or formatter configured (no `test`/`lint` script, no such dependencies) —
there's nothing else to run. `node --watch` is used in place of `nodemon`.

**Required to boot at all**: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — the process throws on startup if
either is missing. `MONGODB_URI` defaults to `mongodb://127.0.0.1:27017/Study` if unset. Everything else
(`OPENROUTER_API_KEY`, Stripe keys, OAuth client credentials, `RESEND_API_KEY`) is optional at boot — its
absence only disables that specific feature (a warning is logged, not a crash) — see each section below for
what breaks without it.

## Architecture

```
src/
├── index.js          Entrypoint: middleware chain, DB connect, route mounting, error handling, startup jobs
├── routes/            HTTP layer — thin, delegate to services
│   └── admin/          Mounted at /api/admin, gated by requireAuth + requireAdmin
├── models/             Mongoose schemas
├── middleware/          auth, adminAuth, csrf, subscription gating
├── services/            Business logic, grouped by domain (see below)
│   ├── auth/             password, tokens, email, sessions, lockout, oauth, avatars, deletion
│   ├── billing/           stripe, webhookHandlers, subscription, emails, referrals
│   ├── analytics/         activity/streaks, AI cost-pricing estimates
│   └── admin/             pricing cache, revenue stats, usage stats, user admin actions
├── ai/                  AI provider abstraction + generation pipeline (see below)
├── prompt/               Prompt composition (see below)
└── scripts/              One-off/maintenance scripts (see Notable Scripts)
```

This is a **routes → services** architecture, not routes → controllers → repositories — routes are thin,
services own the logic, Mongoose models are the only data-access layer (no separate repository layer). Keep
new features in this shape: a route handler that validates input, calls a service function, and shapes the
response — not business logic inlined into the route.

### Entrypoint middleware chain (order matters — `src/index.js`)

`helmet()` → `cors({origin: CLIENT_ORIGIN||true, credentials:true})` → `cookieParser()` → **Stripe webhook
route mounted with `express.raw()` before JSON parsing** (`/api/billing/webhook` — it must see the raw body
to verify the Stripe signature) → `express.json({limit:"2mb"})` → global rate limiter on `/api` → static
`/uploads` (avatars only) → routes → 404 handler → centralized error middleware.

Process-level `unhandledRejection`/`uncaughtException` handlers log and **keep the process alive**
deliberately — the in-process job queue (see Performance) would lose all in-flight generation jobs on a
crash, so this is a considered tradeoff, not an oversight; don't "fix" it into a crash-and-restart pattern
without addressing that.

On boot: `reconcileStrandedJobs()` runs once (marks any `StudyPackage` stuck `generating` after a restart as
failed — see `docs/adr/0001` for why this exists instead of a durable queue), and `purgeExpiredDeletions()`
runs immediately then hourly.

## API Rules

- REST-ish resource routes, JSON in/out, standard status codes (401 unauthenticated, 402 for
  `requireActiveSubscription` failures, 403 forbidden/admin-only, 404, 429 for rate limits/quota).
- **Generation is async, not request/response**: `POST` to start returns `202` immediately with a package
  id; the frontend polls a status endpoint (`status`/`progress`/`progressDetail` fields on `StudyPackage`).
  Never make a generation endpoint block until the AI call finishes.
- Errors from the centralized handler are JSON (`{ error, ... }`-shaped, never a raw stack trace), with
  special-cased messages for `entity.parse.failed`, `LIMIT_FILE_SIZE`, `LIMIT_FILE_COUNT`/
  `LIMIT_UNEXPECTED_FILE` (multer errors) — match this shape for any new error path rather than throwing an
  unhandled exception that falls through to a generic 500.
- Admin routes are **all** double-gated: `requireAuth` then `requireAdmin` — never gate on `requireAdmin`
  alone (it assumes `req.user` is already populated).

## AI Generation Pipeline

Full flow from upload to a saved `StudyPackage`:

1. **Upload** (`routes/packages.js`) — multer, `memoryStorage()` only (nothing hits disk here). Supported
   types: PDF (`pdf-parse`/`pdfjs-dist`), DOCX (`mammoth`), PPTX (`officeparser`/`jszip` for embedded
   images), plain text/Markdown, subtitle files (SRT/VTT), and YouTube URLs (`youtube-transcript`). Hard
   caps: 250MB/file, 50 files/request (multer-level); actual per-plan limits (free/pro/enterprise) are
   enforced in-route from `services/subscription.js`'s `PLAN_LIMITS`.
2. **Extraction** (`services/extract.js`) — per-file-type text + embedded-image extraction; images are
   compressed with `sharp` and stored as base64 inside the `StudyPackage` document itself (no object
   storage — see root `CLAUDE.md`'s ADR-0002 note).
3. **Chunking** (`ai/pipeline/chunking.js`) — large inputs split into bounded per-source chunks so no single
   AI call's input/output blows past its token budget; small inputs skip this and go through the full
   single-pair-of-calls path directly.
4. **Prompt construction** (`prompt/`) — small named fragments composed per call type:
   - `counts.js` — target section counts scaled to input size.
   - `rules.js` — every reusable instruction fragment (formatting, LaTeX, diagrams, subject classification,
     code-example rules, adaptive-practice-style rules, etc.), each defined once.
   - `schema.js` — the JSON shape each call must return, composed per call type from shared field
     fragments (`JSON_FIELD`).
   - `examples.js` — worked examples shown to the model to calibrate output depth/quality.
   - `builders.js` — assembles the above into the actual system prompts (`TEACHING_SYSTEM_PROMPT`,
     `ASSESSMENT_SYSTEM_PROMPT`, chunk/synthesis variants, per-section regeneration prompts) and user
     messages.
   - `index.js` — the only barrel other code should import from.

   The model classifies the material's subject (Programming, Computer Science Theory, Mathematics, Physics,
   Chemistry, Biology, English, History, Business, Economics, Law, Medicine, Other) as the first step of
   its own reasoning and conditionally fills subject-specific fields (e.g. chapter `code_examples`) — this
   happens **inside** the existing calls, not as a separate classification call, specifically to avoid
   adding a third sequential round-trip to a pipeline whose main goal is speed.
5. **Generation** (`ai/generation/`) — for typical inputs, `fullGeneration.js` fires **TEACHING**
   (summary/core_concepts/study_notes/chatbot_context — the only half that sees images) and **ASSESSMENT**
   (quiz/flashcards/practice_tasks/etc. — text only) as two calls via `Promise.allSettled`, in parallel.
   This halves wall-clock time versus one serial call, and if one half fails after retries, the other
   half's real content is kept (not discarded) and the missing sections flow into step 7. Large multi-file
   inputs instead go through `chunkedGeneration.js`: per-source chapter generation (bounded concurrency via
   `ai/pipeline/concurrency.js`'s `runWithConcurrency`), then a synthesis step that applies the same
   teaching/assessment parallel split to a *distilled* version of the chapters (not the raw transcripts
   again — keeps the synthesis call's input bounded regardless of how much source material there was).
   `sectionGeneration.js` is the single shared code path for regenerating one section, used by both the
   manual `/regenerate` route and step 7's automatic recovery — don't add a second implementation of
   "regenerate one section."
6. **AI provider call** (`ai/provider/`) — `provider/index.js` is the abstraction (`getProvider()`), backed
   today by `provider/openrouter.js` only. **Always call through this abstraction, never import the
   OpenRouter client directly** — this is what makes swapping/adding a provider a config change instead of
   an every-call-site change. Every call passes through the global rate limiter (`ai/rateLimiter.js`) —a
   process-wide rolling-window gate, `OPENROUTER_RPM_LIMIT`/`OPENROUTER_TPM_LIMIT` (default 10 req/min /
   250k tokens/min, env-overridable) — callers queue serially rather than racing for a slot.
7. **Validation** (`ai/pipeline/packageValidator.js`) — every section is checked independently; a bad
   section is recorded, never thrown — the rest of the package keeps flowing.
8. **Repair** (`ai/pipeline/recoveryManager.js`) — sections marked invalid are regenerated concurrently
   (bounded via the same `runWithConcurrency` helper), each via `sectionGeneration.js`. An unrecoverable
   `summary` still fails the whole generation (a package with no teaching content isn't useful); every
   other unrecoverable section defaults to a safe empty value and the package still saves as `completed`.
9. **Storage** — merged package saves to `StudyPackage` (`summary`, `core_concepts`, `quiz`, etc. are all
   `Schema.Types.Mixed` deliberately, so a slightly different AI output shape never crashes a save — the
   service layer is where real shape validation happens, not the Mongoose schema).
10. **Response** — the frontend polls `status`/`progress`/`progressDetail` until `completed` or `failed`.

**JSON repair, retries, and truncation**: `ai/pipeline/jsonRepair.js` handles malformed/truncated JSON
extraction from a raw model response before it ever reaches validation; `callAi.js` (in `ai/generation/`)
owns per-call-type token/timeout budgets (`MAX_OUTPUT_TOKENS`, `CALL_TIMEOUT_MS`, keyed by call kind:
`teaching`/`assessment`/`section`/`explain`/`chat`/`image`/`chunk`) and retry-with-backoff on 429/5xx via the
provider layer.

## AI Rules

- **Never call an AI provider client directly** — always go through `ai/provider/index.js`'s
  `getProvider()`. Adding a second provider means adding one entry to that registry, not touching every
  call site.
- **Never trust a raw AI response as final.** Every response goes through `extractJson` (repair) →
  `validateSections` (soft validation) → `recoverInvalidSections` (targeted repair) before it's saved.
  If you add a new AI-generated field, make sure it's covered by this path, not bypassing it.
- **Quota/timeout/invalid-response handling already exists** (`abortState` short-circuit pattern in the
  chunked path, `assertNotTruncated`, the rate limiter's queueing) — extend these, don't add a parallel
  try/catch-and-ignore around a raw provider call.
- Keep per-call-type token/timeout budgets in `callAi.js`'s `MAX_OUTPUT_TOKENS`/`CALL_TIMEOUT_MS` — don't
  hardcode a magic number at a call site.

## Database Rules

- 11 Mongoose models: `User` (account + embedded `refreshTokens[]`/`connectedAccounts[]`), `StudyPackage`
  (generated content, `Mixed`-typed for AI-shape flexibility, `status`/`progress`/`progressDetail` for
  async generation), `QuizAttempt`, `FlashcardReview`, `DailyActivity` (streaks), `AiUsage` (token/cost log
  per call, `kind` enum: `generate`/`chunk`/`synthesis`/`regenerate`/`explain`/`chat`/`image_extract`),
  `Invoice` (mirrors Stripe), `AdminActionLog` (audit trail), `ErrorLog`, `ContactMessage`, `SupportTicket`.
- `StudyPackage`'s top-level content fields are `Schema.Types.Mixed` on purpose — validate AI output shape
  in the service layer (the `ai/pipeline/` validators), not by tightening the Mongoose schema. The handful
  of **explicitly-typed** subdocuments (e.g. `metadata`) are the exception — a new field there (like
  `material_category`) must be added to the schema by name or it's silently dropped on save.
- Account deletion is soft-delete + a scheduled purge (`services/auth/deletion.js`, 30-day window,
  `purgeExpiredDeletions()`), not an immediate hard delete.
- No object storage exists — the only thing persisted to local disk is user avatars
  (`services/auth/avatars.js`, `server/uploads/avatars/`), which is explicitly flagged as a scaling gap in
  `docs/adr/0002-avatar-object-storage.md`. Don't add a second local-disk persistence path without reading
  that ADR first.

## Security

- **Auth**: JWT access token (HS256, 15min, `Authorization: Bearer`) + opaque refresh token (32-byte random,
  HMAC-SHA256-hashed with `JWT_REFRESH_SECRET` before storage, httpOnly cookie scoped to `/api/auth`,
  30-day/1-day TTL, max 10 concurrent sessions with oldest eviction).
- **Passwords**: `bcryptjs`, 12 salt rounds; minimum 8 chars + letter + number enforced at registration.
- **OAuth**: Google + GitHub, hand-rolled authorization-code flow (`services/auth/oauth.js`) — no Passport.
  Supports both fresh login and linking a provider to an already-logged-in account via a signed `state`
  param.
- **CSRF**: double-submit cookie (`csrf_token` cookie / `X-CSRF-Token` header), applied only to `/refresh`
  and `/logout` — the only routes that authenticate purely via the auto-sent cookie. Bearer-token routes
  don't need it.
- **Rate limiting**: global `/api` (600/15min), `authLimiter` on auth routes (20/15min), `contactLimiter` on
  the public contact form (5/hour) — on top of the AI-specific limiter described above. Add a scoped
  limiter for any new unauthenticated public endpoint, following the `contactLimiter` pattern.
- **Brute force**: per-account lockout after repeated failed logins (`services/auth/lockout.js`, 5
  attempts → 15min), independent of the IP-based rate limiter.
- **Authorization**: `requireAuth` (JWT + ban check + plan sync) is distinct from `requireAdmin` (role
  check, must run after `requireAuth`) is distinct from `requireActiveSubscription` (plan gate, 402) — these
  compose, they don't substitute for each other.
- **Audit trail**: admin actions are logged to `AdminActionLog` — extend this for any new admin mutation
  rather than leaving it unlogged.

## Logging

`ErrorLog` persists server errors/warnings to the database (surfaced in the admin panel, not just stdout).
`AiUsage` logs every AI call's tokens/cost/kind/model. `AdminActionLog` logs every admin action. Follow these
existing patterns for anything that should be auditable or debuggable after the fact — don't rely on
`console.log` alone for anything an admin or a future debugging session would need.

## Error Handling

- The process never crashes on an unhandled AI/DB error mid-request — the centralized error middleware and
  the process-level rejection/exception handlers (see Architecture) exist specifically to keep the job
  queue and other in-flight work alive.
- Generation failures are recorded on the `StudyPackage` (`status: "failed"`, `generationError`) and
  surfaced to the frontend via polling — never let a generation failure disappear silently.

## Performance

- **In-process priority job queue** (`services/jobQueue.js`) — Pro jobs run ahead of Free jobs, bounded
  concurrency (currently 2). It does **not** survive a restart (see `docs/adr/0001`) — `reconcileJobs.js`'s
  `reconcileStrandedJobs()` cleans up anything left `generating` after a crash/restart rather than resuming
  it.
- **Bounded concurrency everywhere multiple AI calls can fire from one request** — `ai/pipeline/
  concurrency.js`'s `runWithConcurrency(items, limit, worker)` is the shared implementation, used by chunk
  summarization and section recovery. Use it for any new "fan out N AI calls from one request" need instead
  of a raw unbounded `Promise.all`.
- **Parallel TEACHING/ASSESSMENT calls** (see AI Generation Pipeline step 5) is the main generation-speed
  lever that's already been pulled — before adding new speed optimizations, confirm you're not
  reintroducing a serial call where a parallel path already exists.

## Testing

No test suite exists in this repository (no `*.test.js`, `*.spec.js`, `__tests__/`, or Jest/Vitest
config/dependency). Don't reference test commands that don't exist. If asked to add tests, this is a
greenfield decision (framework choice included), not "run the existing suite."

## Code Standards

- ESM throughout (`"type": "module"`), Node's native `--watch` instead of nodemon, no build step for the
  backend itself.
- Services are grouped by domain into subfolders (`auth/`, `billing/`, `analytics/`, `admin/`) once a domain
  has more than one or two files — follow this grouping for a new domain rather than adding more flat files
  to `services/`.
- No dependency-injection framework — services import each other directly. Keep this simple and explicit;
  don't introduce a DI container for a codebase this size.
- Document the *why* on anything non-obvious (a retry policy, a deliberate tradeoff, a security boundary) —
  this codebase's existing comments consistently do this and it's load-bearing for future changes (e.g. the
  "why the process doesn't crash on unhandled rejection" comment prevents someone from "fixing" that into a
  regression).

## Notable Scripts (`server/scripts/`)

One-off/maintenance scripts, not part of the request-serving app: `stripe-setup.mjs` (provisions the Stripe
Product/Prices/Billing-Portal config — run once per Stripe environment), `grant-admin.mjs` (CLI to
grant/revoke the admin role — there is no self-serve admin-promotion endpoint, this is intentional),
`purge-deleted-accounts.mjs` (external-cron alternative to the app's built-in hourly purge),
`backfill-firstname-lastname.mjs` (one-time data migration), `generate-og-default.mjs` (dev tool for the
static fallback OG image).

## Future Scalability

Two concrete, documented gaps are the actual near-term roadmap — read them before working in either area:
`docs/adr/0001-durable-job-queue.md` (replace the in-process queue with BullMQ + Redis to support
multi-instance deploys and job durability across restarts) and `docs/adr/0002-avatar-object-storage.md`
(move avatar storage off local disk to S3-compatible object storage for the same reason). Both are
"Proposed," not implemented — don't assume either exists yet.

Beyond those two, there's no committed roadmap in the repo for things like additional AI providers, teams/
organizations, public API keys, or a mobile client — the provider abstraction (`ai/provider/`) and the
service-by-domain structure (`services/{auth,billing,analytics,admin}/`) are the two design choices already
in place that would make such additions incremental rather than a rewrite. If asked to design toward one of
these, extend those existing seams rather than introducing a new architectural layer.
