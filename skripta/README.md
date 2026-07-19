# LectureAI — AI Study Package Generator

Upload lecture material (transcript, YouTube link, or multiple files — PDF/PPTX/DOCX/TXT/MD/SRT/VTT/images) → get a complete study package: chapter-by-chapter summary, core concepts, study notes, a quiz, flashcards, practice tasks, true/false and short-answer questions, a glossary, and an AI tutor chatbot scoped to that material.

**Stack:** Vue 3 (Vite, Pinia, Tailwind v4) · Express · MongoDB (Mongoose) · OpenRouter API · JWT auth

```
skripta/
├── server/          Express API + MongoDB + OpenRouter integration
│   └── src/
│       ├── index.js                entry point (helmet, rate limiting, CORS, routes)
│       ├── prompt.js               the full generation prompt + material-scaled content counts
│       ├── models/{User,StudyPackage}.js
│       ├── middleware/auth.js      JWT auth guard
│       ├── routes/{auth,packages,chat}.js
│       ├── services/openrouter.js  OpenRouter client (streaming/non-streaming, retry, timeout, errors)
│       ├── services/aiGeneration.js  chunking + retry policy + JSON extraction + validation
│       ├── services/extract.js     PDF/DOCX/PPTX/SRT/VTT/YouTube text extraction
│       ├── services/auth/          password hashing, tokens, dev-mode email links
│       ├── services/subscription.js  plan limits (free/pro/enterprise)
│       └── services/jobQueue.js    in-process priority queue for background generation
└── client/          Vue 3 SPA
    └── src/
        ├── pages/    Landing, Login/Register/ForgotPassword/ResetPassword/VerifyEmail,
        │             Dashboard, Upload, StudyPackage (tabbed), Settings
        ├── stores/   auth, theme, locale, toast, upgrade (Pinia)
        └── components/  QuizPlayer, FlashcardDeck, TrueFalseQuiz, ChatPanel, UpgradeModal, ...
```

## Setup

Requirements: Node 18+, MongoDB running locally (or an Atlas URI), an [OpenRouter API key](https://openrouter.ai/keys).

### 1. Install + configure

```bash
npm run install:all     # installs server/ and client/ dependencies
cd server
cp .env.example .env
# edit .env: set OPENROUTER_API_KEY, and generate two secrets with `openssl rand -hex 48`
# for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET — the server refuses to start without them
cd ..
```

### 2. Run

```bash
npm run dev              # starts the API (:3000) and the client (:5173) together
```

Open http://localhost:5173, register an account, click **+ New package**.

The client's Vite dev server proxies `/api/*` to `http://localhost:3000` (see
`client/vite.config.js`) — if you ever see a Vite "http proxy error ECONNREFUSED"
for an `/api/*` request, it means the backend isn't running. `npm run dev` from
the repo root always starts both together so this can't happen; running only
`cd client && npm run dev` on its own will reproduce the error, since nothing
is listening on :3000 in that case. If you prefer separate terminals/logs, you
can still run each side individually:

```bash
cd server && npm run dev   # API on http://localhost:3000
cd client && npm run dev   # app on http://localhost:5173
```

## Accounts & subscriptions

- Full JWT auth: register/login/logout, refresh (rotating refresh token in an httpOnly cookie), forgot/reset password, email verification, change password, profile update, account deletion.
- **No email provider is wired up.** Verification and password-reset links are logged to the server console (and returned in the API response in dev) instead of being emailed — see `services/auth/email.js` to plug in a real provider.
- Three plans (free/pro/enterprise) gate package count, files per package, max file size, and AI Tutor messages per package — see `services/subscription.js`. **No payment processor is wired up either**: `POST /api/auth/upgrade` flips the plan directly (used by the in-app "Upgrade to Pro" button); swap in real Stripe Checkout there when ready.
- Every study package belongs to a user; all package/chat routes are ownership-scoped.

## How generation works

1. `prompt.js` holds the system prompt (output rules, full JSON schema, LaTeX rendering rules, multi-source handling). Quiz/flashcard/practice-task/etc. counts scale with how much material was provided (a tiered lookup by character count) instead of a fixed number.
2. Generation is asynchronous: `POST /packages/generate|from-youtube|from-files` creates the package immediately (`status: "queued"`) and returns 202; a background job (a small in-process priority queue — Pro jobs run ahead of Free ones) extracts text, calls the AI provider via OpenRouter, and saves the result, updating `status`/`progress` for the frontend to poll (`GET /packages/:id`).
3. `services/aiGeneration.js` retries transient errors (429/500/502/503/504) with exponential backoff via `services/openrouter.js`, then extracts/repairs the JSON response and validates section counts against the material-scaled targets.
4. Multi-file uploads keep the Summary split by source document (tagged with `source_index`/`source_title`) while every other section synthesizes across all uploaded files as one course.
5. The chat endpoint builds its system prompt from the stored `chatbot_context` + `full_lecture_summary` — no re-extraction needed at chat time.

## Notes

- Model is configurable via `OPENROUTER_MODEL` in `.env` (default `openrouter/free`).
- Transcript limits: min 50 chars, max 400k chars (combined across files for multi-file uploads).
- Uploaded files are never stored as raw blobs (no object storage is configured) — only their extracted text is persisted, indefinitely, alongside filename/type/order for future regeneration.
- To deploy: `cd client && npm run build`, serve `client/dist` statically and point it at the API origin; set `CLIENT_ORIGIN` and `CLIENT_URL` in the server's `.env` for production CORS/email-link generation.
