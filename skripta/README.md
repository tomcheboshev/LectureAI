# Skripta — AI Study Package Generator

Paste a lecture transcript → get a complete study package: chapter summary, core concepts, exam notes, an interactive 5-question quiz, flashcards, practice tasks, true/false and short-answer questions, a glossary, and a chatbot that answers questions about that specific lecture.

**Stack:** Vue 3 (Vite) · Express · MongoDB (Mongoose) · Anthropic Claude API

```
skripta/
├── server/          Express API + MongoDB + Claude integration
│   └── src/
│       ├── index.js             entry point
│       ├── prompt.js            the full generation prompt
│       ├── models/StudyPackage.js
│       ├── routes/packages.js   generate / list / get / delete
│       ├── routes/chat.js       lecture-scoped chatbot
│       └── services/claude.js   API calls + JSON extraction + validation
└── client/          Vue 3 SPA
    └── src/
        ├── views/    Home, NewPackage, Package (tabbed)
        └── components/  QuizPlayer, FlashcardDeck, TrueFalseQuiz, ChatPanel
```

## Setup

Requirements: Node 18+, MongoDB running locally (or an Atlas URI), an Anthropic API key.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env    # then edit .env and paste your ANTHROPIC_API_KEY
npm run dev             # API on http://localhost:3000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev             # app on http://localhost:5173 (proxies /api to :3000)
```

Open http://localhost:5173, click **+ New package**, paste a transcript, generate.

## API

| Method | Route | Body | Description |
|---|---|---|---|
| POST | `/api/packages/generate` | `{ video_title, subject, difficulty, transcript }` | Calls Claude, validates the JSON, saves to MongoDB |
| GET | `/api/packages` | — | Light list for the home page |
| GET | `/api/packages/:id` | — | Full study package |
| DELETE | `/api/packages/:id` | — | Delete a package |
| POST | `/api/chat/:id` | `{ messages: [{role, content}] }` | Chatbot grounded in the stored `chatbot_context` |

## How generation works

1. `prompt.js` holds the full system prompt (output rules + required JSON structure + all 15 section requirements + quality control checklist). The user's input is injected as a JSON user message.
2. `services/claude.js` calls the Messages API with `max_tokens: 16000`, strips any stray code fences, extracts the first top-level `{...}`, parses with `JSON.parse`, and runs count checks (quiz = 5 with 4 options each and a matching `correctAnswer`, tasks = 3, T/F = 5, short answer = 3). Violations are logged as warnings, not hard failures.
3. The parsed object is stored 1:1 in MongoDB (`Schema.Types.Mixed` for nested content so a slightly off shape never crashes a save). The raw transcript is kept with `select: false` so it's stored but never sent to the client.
4. The chatbot endpoint builds its system prompt from the stored `chatbot_context` + `full_lecture_summary` — no transcript needed at chat time, which keeps chat calls cheap.

## Notes

- Model is configurable via `CLAUDE_MODEL` in `.env` (default `claude-sonnet-4-5`).
- Transcript limits: min 50 chars, max 400k chars (enforced server-side).
- Chat history is sanitized and capped at the last 20 messages per request.
- To deploy: `cd client && npm run build`, serve `client/dist` statically (e.g. from Express with `express.static`) and point the frontend at the API origin.
