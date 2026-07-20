# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the **root** guidance file. The frontend has its own [`client/CLAUDE.md`](client/CLAUDE.md) and the
backend its own [`server/CLAUDE.md`](server/CLAUDE.md) — read whichever one matches where you're actually
working, in addition to this file. This file covers what's true of the whole project; the other two go deep
on their own half and deliberately don't repeat what's here.

## Project Overview

**LectureAI** turns uploaded lecture material — PDF, DOCX, PPTX, plain text/Markdown, subtitle files
(SRT/VTT), or a YouTube URL — into a complete AI-generated study package: chapter summaries, core concepts,
study notes, quiz, flashcards, practice tasks, true/false, short-answer questions, a glossary, a learning
path, and a scoped AI tutor chatbot grounded only in that package's content. It's a subscription SaaS: free /
pro / enterprise plans gate upload limits and generation quotas, billed through Stripe.

It is **two independent npm projects** — `client/` (Vue 3 SPA) and `server/` (Express API) — orchestrated
from this root only for local development. There is no npm-workspaces/monorepo tooling; each has its own
`package.json` and lockfile and is deployed independently (see **Deployment** below).

**Current maturity, read literally from what's in the repo:** real, fully-wired JWT auth, OAuth (Google/
GitHub), Stripe billing, and Resend email — but no test suite, no lint/format config, and no CI/CD or
deployment config (Dockerfile, CI workflow, etc.) exist anywhere in the repo. Two "Proposed" (not yet
implemented) ADRs in `docs/adr/` describe known scaling gaps — read those before touching the areas they
cover:
- **`docs/adr/0001-durable-job-queue.md`** — background generation currently runs on an in-process priority
  queue (`server/src/services/jobQueue.js`). It has no durability across restarts/deploys and does not
  support running more than one server instance. Proposes BullMQ + Redis.
- **`docs/adr/0002-avatar-object-storage.md`** — every upload is processed in memory and never touches disk
  *except* user avatars, which are written to local disk at `server/uploads/avatars/` and served statically.
  That's the one place the app currently assumes a persistent, single-instance filesystem. Proposes S3-
  compatible object storage.

**A note on `README.md`:** it currently states "no payment processor is wired up" and "no email provider is
wired up." Both are stale — `server/.env` has a full live Stripe integration (checkout, webhooks, portal,
4 price tiers, referral coupons) and `services/auth/email.js` / `services/billing/emails.js` send real email
through Resend (falling back to console-logging only when `RESEND_API_KEY` is unset). Trust the code over the
README on this point.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | Vue 3 (Composition API, `<script setup>`), Vite 6 |
| Frontend routing | Vue Router 4 |
| Frontend state | Pinia |
| Styling | Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`) |
| Backend framework | Express 4 (ESM, `"type": "module"`) |
| Database | MongoDB via Mongoose 8 |
| Authentication | Hand-rolled JWT access token (15min) + opaque refresh token (httpOnly cookie), Google/GitHub OAuth |
| Payments | Stripe (Checkout + Billing Portal + webhooks) |
| AI | OpenRouter (provider-abstracted — see server docs), no vendor SDK, raw `fetch` |
| Email | Resend (raw `fetch`, no SDK) |
| File parsing | `pdf-parse`/`pdfjs-dist`, `mammoth` (DOCX), `officeparser` (PPTX), `youtube-transcript` |
| Image processing | `sharp` |
| Storage | None (object storage) — uploads are processed in memory; only avatars persist to local disk (see ADR-0002) |
| Deployment | Not configured — no Dockerfile/CI/IaC in the repo; manual "build client, serve `dist/`, point at API origin" only |
| State/data caching | None beyond Pinia store state — no client-side query cache, no server-side response cache |

## Project Structure

```
/                    Root dev orchestrator only (concurrently runs client + server) — no app code here
├── client/          Vue 3 SPA — see client/CLAUDE.md
├── server/          Express API — see server/CLAUDE.md
├── docs/adr/         Architecture Decision Records — read before touching job queue or file storage
└── README.md        Setup instructions (see the staleness note above before trusting its "not wired up" claims)
```

Inside `server/`: `src/routes` (HTTP layer), `src/models` (Mongoose schemas), `src/services` (business logic,
grouped into `auth/`, `billing/`, `analytics/`, `admin/`), `src/middleware`, `src/ai` (provider + generation
pipeline), `src/prompt` (prompt composition), `src/scripts` — full breakdown in `server/CLAUDE.md`.

Inside `client/`: `src/pages`, `src/components` (+ `ui/`, `admin/`, `marketing/` subfolders), `src/layouts`,
`src/stores` (Pinia), `src/composables`, `src/locales` (en/mk), `src/services` (API client) — full breakdown
in `client/CLAUDE.md`.

## AI Pipeline (high level — see `server/CLAUDE.md` for the full mechanics)

1. **Upload** (`routes/packages.js`) — file(s) or a YouTube URL arrive via multer, buffered in memory only.
2. **Extraction** (`services/extract.js`) — per-file-type text + embedded-image extraction.
3. **Cleaning** — extracted text normalized before it ever reaches a prompt.
4. **Chunking** (`ai/pipeline/chunking.js`) — large inputs are split into bounded per-source chunks instead
   of one oversized call, each with its own retry budget.
5. **Prompt construction** (`prompt/` directory) — composed from small named fragments (`rules.js`,
   `schema.js`, `examples.js`, `counts.js`), assembled per call type in `builders.js`. The material is
   classified into a subject category as part of the same call (Programming, Math, History, etc.) so
   subject-specific content (code playgrounds, adaptive practice style, diagram types) is only generated
   when it's actually relevant — never forced onto unrelated material.
6. **Generation** (`ai/generation/`) — for typical inputs, one **TEACHING** call (summary/concepts/notes,
   the only half that sees images) and one **ASSESSMENT** call (quiz/flashcards/practice/etc., text-only)
   run **in parallel** via `Promise.allSettled` — this halves wall-clock generation time versus one call
   producing everything serially, and if one half fails, the other's real content is kept rather than
   discarded. Large multi-file inputs instead go through a chunked path: per-source chapter generation,
   then a synthesis step that reuses the same teaching/assessment parallel split.
7. **Validation** (`ai/pipeline/packageValidator.js`) — every AI response is soft-validated per section,
   never hard-thrown on a single bad field.
8. **Repair** (`ai/pipeline/recoveryManager.js`) — sections that fail validation are regenerated
   individually (concurrently, bounded), not by discarding and re-running the whole package.
9. **Storage** — the assembled package (still `Schema.Types.Mixed`-typed for AI-shape flexibility) saves to
   `StudyPackage`; generation status/progress is polled by the frontend (async job, not a blocking request).
10. **Frontend rendering** (`client/`) — Markdown/LaTeX/Mermaid rendering, the callout system, and
    subject-conditional widgets (code playground, exam-prep tab) render only what the package actually has.

Retry, rate limiting, and fallback behavior (OpenRouter RPM/TPM limiter, model fallback, exponential backoff
on 429/5xx) are documented in `server/CLAUDE.md` — that's where you'll be working if you touch any of it.

## Development Rules

- **Never trust AI output.** Every AI response goes through the validation → recovery pipeline before it's
  saved. If you add a new AI-generated field, it needs the same treatment — don't assume the model always
  returns valid JSON in the exact shape you asked for.
- **Fix root causes, not symptoms.** This codebase has already been through several passes of replacing
  ad-hoc retry hacks with a real provider abstraction and a real validation/recovery pipeline — don't
  reintroduce one-off workarounds where the existing pipeline should handle it instead.
- **Reuse before you rebuild.** The frontend has an established callout system, badge system, and
  code-playground component (`client/CLAUDE.md`); the backend has an established prompt-fragment
  composition pattern and a shared bounded-concurrency runner (`ai/pipeline/concurrency.js`). Extend these,
  don't parallel-build a second version.
- **Keep prompt/schema changes in sync.** Every field added to a `prompt/schema.js` JSON structure needs a
  matching frontend renderer (or it silently never shows), and if it's meant to persist on `StudyPackage`,
  confirm the Mongoose field isn't one of the few explicitly-typed (non-`Mixed`) subdocuments (e.g.
  `metadata`) that need the field added by name.
- **Sanitize and validate at the boundary.** User input (uploads, form fields) and AI output are both
  external input from the backend's perspective — treat both that way, not just one.

## Performance Rules

What's already in place — extend these patterns rather than inventing new ones:
- **Parallel AI calls** (TEACHING/ASSESSMENT split) instead of one long serial call — see AI Pipeline above.
- **Bounded concurrency** everywhere multiple AI calls can fire from one request (chunk summarization,
  section recovery) via the shared `runWithConcurrency` helper — never fire an unbounded `Promise.all` over
  a user-controlled list size.
- **Global AI rate limiting** (`ai/rateLimiter.js`) — a process-wide rolling-window gate in front of every
  OpenRouter call, independent of the in-process job queue's own concurrency cap.
- **In-process priority job queue** for background generation — Pro jobs run ahead of Free jobs, bounded
  concurrency (currently 2).
- Vite's default code-splitting/lazy route chunks and the prerendering pipeline (`client/scripts/prerender.mjs`)
  handle frontend load performance — see `client/CLAUDE.md`.

What's explicitly **not** in place yet (don't assume it exists): a durable/distributed job queue (ADR-0001),
object storage for uploads (ADR-0002), any server-side response cache, or a client-side data cache beyond
Pinia store state.

## Security Rules

- **Auth**: short-lived JWT access tokens (15min, Bearer header) + opaque, hashed refresh tokens (httpOnly
  cookie, 30-day "remember me" / 1-day default, max 10 concurrent sessions, oldest evicted).
- **Passwords**: bcrypt, 12 salt rounds, minimum strength enforced at registration.
- **CSRF**: double-submit cookie, scoped only to the routes that rely solely on the auto-sent refresh
  cookie (`/refresh`, `/logout`) — Bearer-token routes don't need it and don't have it.
- **Brute force**: IP-based rate limiting on auth routes plus per-account lockout after repeated failures.
- **Global middleware**: `helmet`, `cors` (credentialed, origin from `CLIENT_ORIGIN`/`CLIENT_URL`), a global
  `/api` rate limiter, and a centralized error handler that never leaks stack traces to the client.
- **Secrets**: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are required — the server refuses to boot without
  them. Stripe/OAuth/OpenRouter secrets are optional at boot (warned, not fatal) but required for those
  features to function.
- **Frontend access-token storage**: kept in memory only (never `localStorage`) specifically to reduce XSS
  blast radius — don't change this without understanding why it's deliberate.
- **Authorization**: role-based (`requireAdmin` after `requireAuth`) for the admin surface, plan-based
  (`requireActiveSubscription`, `PLAN_LIMITS`) for pro-gated features — these are two distinct checks, don't
  conflate "logged in," "admin," and "paying."

## Coding Standards

- **No test suite, no lint/format config exist anywhere in this repo.** Don't invoke `npm test`, `npm run
  lint`, or similar — they don't exist. Match the surrounding code's existing style by hand; there's no
  tool enforcing it.
- **ESM throughout the backend** (`"type": "module"` in `server/package.json`) — no `require()`.
- **Comments explain *why*, not *what*** — this codebase's existing comments consistently document a
  non-obvious constraint or the reason a design choice was made (e.g. why a call is split in two, why a
  token is stored in memory instead of `localStorage`), not a restatement of the code. Match that.
- **Small, named, composable units** on both sides — the prompt system is deliberately split into small
  reusable fragments (`rules.js`) composed per call type rather than duplicated inline; the frontend has an
  equivalent composables layer. Prefer extending these over inlining logic into a route handler or a page
  component.

## Project Goals

- A study package should read like a premium interactive textbook (Notion/GitBook/NotebookLM-grade), not a
  plain AI summary — and only include the widgets (code playground, diagrams, exam prep) that are actually
  relevant to the uploaded material's subject.
- Generation should stay fast — the parallel-call architecture exists specifically because a single serial
  call was the dominant latency cost; don't reintroduce serial AI calls where a parallel or chunked path
  already exists.
- Keep the codebase's actual maturity honest in any documentation you write or update: this is a working,
  fully-authenticated, billed SaaS with no test suite, no CI, and no deployment automation yet — don't
  describe capabilities (deployment pipelines, multi-instance scaling, automated testing) that don't exist.
