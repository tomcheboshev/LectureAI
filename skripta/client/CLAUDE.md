# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in `client/` (the
LectureAI frontend). Read together with the root [`../CLAUDE.md`](../CLAUDE.md), which covers the project
as a whole and isn't repeated here.

## Purpose

The frontend is a Vue 3 SPA responsible for: auth flows, the upload/generation UX, rendering AI-generated
study packages as a premium interactive reading experience, the marketing site (prerendered for SEO), and a
full admin panel. It talks to the backend exclusively through `src/services/api.js` (and `adminApi.js` for
the admin surface) — no other module should call `axios`/`fetch` directly against the API.

## Commands

```
npm run dev       # Vite dev server on :5173, proxies /api/* to localhost:3000 (server must be running)
npm run build      # client bundle + SSR prerender pass + sitemap, discards the SSR build afterward
npm run preview    # preview the production build locally
```

There is no test runner, linter, or formatter configured in this project (`package.json` has no
`test`/`lint`/`format` scripts and no such dependencies) — there's nothing to run beyond the three above.
Match existing code style by hand.

**Dev server gotcha**: the Vite dev server proxies `/api` to `http://localhost:3000`. If you run `npm run
dev` from `client/` alone (not the root orchestrator), the backend won't be running and every API call will
fail with `ECONNREFUSED` through the proxy — either run `npm run dev` from the repo root, or start
`server/` yourself first.

## Tech Stack

Vue 3 (Composition API, `<script setup>` everywhere) · Vite 6 · Vue Router 4 · Pinia · Tailwind CSS v4
(CSS-first config in `src/style.css`, no `tailwind.config.js`) · Axios · KaTeX (math) · `highlight.js` core
build with hand-picked languages (js/ts/python/java/cpp/csharp/go/rust/sql/bash/json/xml/css/php/ruby) ·
Mermaid (diagrams, lazy-loaded via dynamic `import()` only when a diagram is actually present) · Chart.js
(admin dashboards) · `@heroicons/vue` · `@unhead/vue` (SEO head management).

## Routing & Layouts

Routes live in `src/router/index.js` as one array, reused by `client/scripts/prerender.mjs` to know which
routes to prerender/sitemap. Three guard flags drive `router.beforeEach` (skipped entirely during SSR):
- `requiresAuth` → redirect to `/login?redirect=...` if not authenticated.
- `requiresAdmin` → redirect to `/dashboard` if `auth.user?.role !== "admin"`.
- `guestOnly` → redirect authenticated users away from login/register/forgot-password.

Three layouts selected per-route (`layout: "landing" | "admin"`, default is the authenticated app shell):
`AppShell.vue` (authenticated app), `AdminShell.vue` (admin panel), and the marketing chrome
(`MarketingHeader`/`MarketingFooter`/`Breadcrumbs` in `components/marketing/`) for public pages.

## State Management (Pinia)

Six stores in `src/stores/`, each with a narrow, non-overlapping responsibility:
- `auth.js` — session (`user`, `limits`, `usage`), `isAuthenticated`/`isPro` getters, `init()` for
  silent-refresh restore on boot.
- `billing.js` — subscription/invoices, fetched on demand (not at boot).
- `locale.js` — active UI language, persisted to `localStorage`.
- `theme.js` — dark/light mode, persisted to `localStorage`, toggles a `dark` class on `<html>`.
- `toast.js` — toast queue with `success()`/`error()`/auto-dismiss.
- `upgrade.js` — controls the "upgrade to Pro" modal, triggered from `useApiError.js`.

Don't add a seventh store for something one of these already owns — e.g. a new API error path almost
certainly belongs in the existing `toast`/`upgrade` decision in `useApiError.js`, not a new store.

## UI Philosophy

Premium, modern, minimal, and educational — the explicit bar is Notion / GitBook / NotebookLM, not "a plain
AI summary with some styling." Concretely, that means:
- Dense information gets **structure** (headings, callouts, tables, disclosure sections), not one long
  paragraph.
- Animation is restrained and purposeful (`animate-fade-up`, `animate-float`, route transitions,
  `useConfetti.js` for a specific celebratory moment) — never decorative motion for its own sake.
- A page never shows a blank void while something is happening or empty — see **Page Standards** below.
- Dark mode is a first-class, tested state for every surface, not an afterthought pass.

## Component Rules

- Small, single-purpose components. `src/components/` is flat at the top level with three purpose-scoped
  subfolders: `ui/` (generic primitives — `Modal`, `EmptyState`, `ToastContainer`), `admin/`
  (`AdminSidebarContent`, `ChartCanvas`), `marketing/` (`Breadcrumbs`, `MarketingHeader`, `MarketingFooter`).
  Put a new component in the matching folder rather than the flat top level if it fits one of those roles.
- Shared interactive behavior is a composable, not copy-pasted: `useClickOutside`, `useModalBehavior`
  (Escape + body-scroll-lock, used by every modal), `useApiError` (toast vs. upgrade-modal routing) are the
  existing examples — reach for these before re-implementing the same behavior locally.
- No TypeScript in this codebase — props are plain `defineProps` with runtime type/default validation, not
  typed interfaces. Keep prop contracts explicit (type + default) rather than untyped passthrough objects.
- Pages that render a route are in `src/pages/` (and `src/pages/admin/`); everything reusable across more
  than one page is a component or composable, not duplicated per-page.

## Page Standards

Every page that loads server data follows the same shape — this was a deliberate audit pass across the app
(loading/empty/error/success states, responsive layout, dark mode), not incidental:
- **Loading**: skeleton placeholders (`.skeleton` shimmer class) for content-shaped loading, not a bare
  spinner, wherever the eventual content has a predictable shape.
- **Empty**: the shared `EmptyState` component (`components/ui/EmptyState.vue`) — icon + title + description
  — not a blank `v-if` gap. Every tab/section on `StudyPackagePage` that can legitimately be empty (a
  section the AI didn't generate) has one.
- **Error**: friendly, actionable messages via `useApiError.js` → toast or upgrade modal, never a raw error
  string or a silent console-only failure.
- **Success**: toast confirmation for user-initiated actions (`toast.success(...)`), consistent phrasing.
- Responsive at minimum down to mobile width; dark mode via the `dark:` variant on every surface that has a
  light background/border/text color.

## Study Package UI (`StudyPackagePage.vue` + its component family)

This is the highest-effort, highest-detail surface in the app — the whole point of the product. Ground
rules when touching it:

- **Subject-adaptive, not one-size-fits-all.** The AI classifies uploaded material by subject
  (`metadata.material_category`) and only certain chapters carry certain widgets — e.g. `code_examples`
  is only populated for genuinely programming/CS content. The frontend must render conditionally
  (`v-if="c.code_examples?.length"`, etc.) and never assume a field is present. A History package having no
  code playground and no formula sheet tab content is correct behavior, not a bug.
- **The callout system** (`style.css`, `.callout` + 7 semantic variants) is the primary way secondary
  information is visually separated from body prose: `definition` (blue), `concept` (green), `example`
  (purple), `mistake` (red), `warning` (orange), `tip` (amber), `info` (gray). These are parsed out of
  AI-generated Markdown by `useMarkdown.js` (fenced code blocks tagged with the type name, e.g.
  ` ```tip `) as well as used directly in the Vue template for dedicated chapter fields (`key_idea`,
  `common_mistakes`, `memory_trick`, `exam_tip`, etc.). Reuse this system for any new "highlighted box"
  UI — don't invent a new box style.
- **Math**: KaTeX via `useLatex.js` (`renderLatexText`/`renderBlockFormula`) — inline `$...$` and display
  `$$...$$` only; block formulas are wrapped in `.katex-display-wrap` for horizontal scroll on overflow,
  never left to overflow the page.
- **Code**: `useMarkdown.js`'s `highlightCode()` (exported, reusable) wraps `highlight.js` for any
  syntax-highlighted block, with a shared `.code-block`/`.code-block-header`/`.code-copy-btn` styling
  convention. `CodeExample.vue` is the dedicated component for chapter `code_examples` entries — it adds
  complexity badges, a common-mistakes callout, collapsible line-by-line explanation, an alternative-solution
  disclosure, and expected-output reveal on top of that base styling. **Only JavaScript gets a real, editable,
  runnable playground** — via a sandboxed `<iframe sandbox="allow-scripts">` with deliberately no
  `allow-same-origin`, so executed (possibly student-edited) code has zero access to the app's DOM, cookies,
  or session. Every other language shows the AI's stated `expected_output` instead of a fake Run button —
  don't add a "Run" affordance for a language you can't actually execute safely client-side.
- **Diagrams**: Mermaid via `useMermaid.js` (lazy dynamic import) rendered inside `RichContent.vue` /
  `MermaidDiagram.vue`, which the AI targets with fenced ` ```mermaid ` blocks — only generated when a
  chapter's content is genuinely graph/state-shaped (see the backend's `DIAGRAM_RULES`), so don't assume
  every chapter has one.
- **Tables**: GitHub-flavored Markdown pipe tables are rendered into `.rich-table-wrap`/`.rich-table` (not
  left as raw pipe text) — that conversion happens in `useMarkdown.js`.
- **Exam Prep tab**: `formulaSheet`/`revisionChecklist` are computed **client-side** from data the package
  already has (chapter `formulas`, `exam_tip`, `study_notes.exam_focus`) — this is a deliberate pattern:
  prefer deriving a new view from existing data over asking the backend for a new AI-generated section,
  since every new AI section costs generation time and money. Follow this pattern before adding a new
  top-level schema field for a "derived" UI need.

## UX Rules

- Generation is asynchronous (202 + status/progress polling) — never block the UI waiting on a generation
  request; show real progress detail (`progressDetail` from the backend) where available.
- Tab panes on `StudyPackagePage` use `v-show`, not `v-if`/`v-else-if` — switching tabs must never unmount
  a pane's component tree, so in-progress state (current quiz question, chat history, learned flashcards)
  survives a tab switch. Keep this pattern for any new tab.
- Every destructive or plan-limited action goes through the existing decision point
  (`useApiError.js`/`upgrade` store), not a bespoke inline error.

## Performance

- Route-level code splitting is Vite's default (dynamic `import()` per route component) — don't manually
  bundle everything into one chunk.
- Mermaid is lazy-loaded on demand (`useMermaid.js`) specifically because it's a large dependency most
  pages never need — follow the same pattern for any other heavy, conditionally-needed library.
- The production build runs an SSR prerender pass (`scripts/prerender.mjs`) for routes flagged
  `meta.seo.prerender: true` — this is for crawler-visible marketing pages, not the authenticated app; don't
  add prerendering to authenticated routes.

## Styling Rules

- All design tokens live in `src/style.css`'s `@theme` block (fonts, color palette, dark-mode variants via
  `@custom-variant dark`) — use the existing `--color-primary`/`--color-success`/`--color-warning`/
  `--color-danger`/`--color-secondary` tokens (and their Tailwind utility equivalents) rather than
  introducing a new raw hex color.
- Reusable class families already exist for badges (`.badge` + `.badge-primary/secondary/success/warning/
  danger`), form fields (`.input-field`), and the callout/code-block/complexity-badge/disclosure-button
  system described above — extend these families, don't hand-roll a one-off equivalent inline.
- No inline `style` attributes for anything expressible in Tailwind utilities or an existing custom class.

## Frontend Error Handling

- `services/api.js`'s response interceptor normalizes every API error into a plain `Error` with `.status`,
  `.upgradeRequired`, `.reason`, `.limit`, `.plan`, `.retryAfterSeconds` — always let errors flow through
  this interceptor rather than catching and re-wrapping them ad hoc in a component.
- A `401` triggers exactly one silent refresh-and-retry (deduped via a shared in-flight promise) before
  falling back to `onUnauthorized()` → session clear — don't add a second retry loop on top of this.
- `useApiError.js`'s `reportApiError(err)` is the single decision point for "toast vs. upgrade modal" —
  route new error-prone actions through it instead of writing a new `if (err.upgradeRequired)` branch.
- The CSRF token is read from a non-httpOnly cookie and echoed as `X-CSRF-Token` automatically by
  `api.js` — you should never need to touch this manually in a component.
