# Premium Learning UI/UX Redesign

**Status:** Draft — awaiting user review
**Date:** 2026-07-20
**Scope:** Frontend-only visual/UX redesign of the generated Study Package reading experience
(`client/src/pages/StudyPackagePage.vue` and its component family). No backend, prompt, schema, or
Mongoose model changes — nothing here changes what data is generated, only how existing data is presented.

## Goal

The generated study package should read like a premium, modern interactive textbook — comparable in feel
to Notion, Linear, Stripe Docs, GitBook, Duolingo, Khan Academy, Brilliant, and Obsidian — not "an AI
summary with some styling." This redesign targets readability, visual hierarchy, and a consistent card/
color language across everything the AI already generates.

## Non-goals

- No new AI-generated fields, prompt changes, or schema/model changes.
- No new tabs or new sections.
- No changes to `CodeExample.vue`'s run/copy/disclosure *behavior* (visual polish only).
- No changes to Mermaid diagram generation logic — only how rendered diagrams are framed/captioned in the
  surrounding layout.

## Current state (baseline, confirmed by reading the code before designing this)

- Tables (`useMarkdown.js` → `.rich-table`/`.rich-table-wrap` in `style.css:260-278`) already have header
  coloring, zebra-striped rows, rounded corners, and horizontal-scroll responsiveness. **No changes needed.**
- KaTeX block formulas already scroll horizontally via `.katex-display-wrap` (`style.css:258`). **No changes
  needed.**
- The callout system (`style.css:160-204`) already has 7 color-coded variants (definition/concept/example/
  mistake/warning/tip/info) with soft backgrounds, subtle borders, and shadows, used both for AI-authored
  inline callouts (parsed from fenced code blocks by `useMarkdown.js`) and for dedicated per-chapter fields
  in `StudyPackagePage.vue` (`key_idea`, `easy_explanation`, `advanced_explanation`, `real_world_analogy`,
  `memory_trick`, `exam_tip`, `common_mistakes`).
- Images (`StudyPackagePage.vue:223-231`) already render with caption + explanation text.
- Formulas (`StudyPackagePage.vue:233-238`) render as a plain dashed-border box — no icon, no title
  treatment, visually inconsistent with the callout cards next to it.
- `exam_tip` currently reuses the generic `.callout-warning` (orange) style — no distinct visual identity
  from an actual warning/caution callout.
- Every premium field's markup (icon + label + styled box) is hand-duplicated inline in
  `StudyPackagePage.vue` rather than going through one shared component.

## Design

### 1. Color system remap

Reuse only colors already defined in `style.css`'s `@theme` block — no new hex values introduced.

| Category | Color | Change |
|---|---|---|
| Definition | blue (`#3b82f6`) | unchanged |
| Concept / Key Idea | green (`--color-success`) | unchanged |
| Example | **cyan** (`--color-accent`) | **moved from purple** — frees purple for Exam-Important |
| Common Mistake | red (`--color-danger`) | unchanged |
| Warning | orange (`--color-warning`) | unchanged |
| Tip | amber (`#eab308`) | unchanged |
| Exam Important | **purple** (`--color-secondary`) | **new dedicated variant** — `exam_tip` no longer shares the generic warning style |
| Extra Info | gray | unchanged |

### 2. New shared `InfoCard.vue` component

New file: `client/src/components/ui/InfoCard.vue`.

Props: `variant` (`definition | concept | example | mistake | warning | tip | info | exam`), `icon`
(emoji/string), `title` (string, optional — falls back to a per-variant default label). Default slot for
body content (supports the same `v-html` LaTeX/Markdown-rendered content the current inline blocks pass).

Internally wraps the existing `.callout` / `.callout-*` CSS classes (consolidated, not duplicated — the
`exam` variant is added alongside the existing 7). This is a pure extraction: it changes *where* the markup
lives, not what it looks like beyond the color remap above and the formula-card upgrade below.

Replaces the current hand-rolled `<div class="callout callout-*">` blocks in `StudyPackagePage.vue` for:
`key_idea`, `easy_explanation`, `advanced_explanation`, `real_world_analogy`, `memory_trick`, `exam_tip`,
`common_mistakes`, and upgrades the formula block (`c.formulas`) to render through the same component
(variant `definition`-adjacent styling with a 📐-style icon and the formula's `name` as title), giving it
parity with the other premium fields instead of a plain dashed box.

### 3. Typography & spacing refinement

`style.css`: `.rich-content-block` gets slightly increased paragraph spacing and line-height for long
study sessions; a defined heading scale for `h2`/`h3`/`h4` inside generated content, so chapter body
sub-headings are visually distinct from the chapter title without introducing a new font.

### 4. Visual hierarchy / section order

Within each chapter card in `StudyPackagePage.vue`, confirm/enforce this reading order: title → key idea
(short intro) → description (detailed explanation) → easy/advanced explanation + real-world analogy →
formulas/examples/code → images/diagrams → common mistakes → memory trick/exam tip (revision aids, last).
This is largely already the current order; the main correction is consistency (formulas/images should
consistently land in the "examples/visuals" zone, not interleaved with the explanation cluster).

### 5. Tables, diagrams, code — polish only

`CodeExample.vue` and `RichContent.vue` get spacing/border/shadow polish to visually match the new
`InfoCard` language (consistent corner radius, border weight, shadow depth). No logic changes — the
JS-only run button, copy button, and disclosure sections behave exactly as today.

### 6. Responsive / dark mode

No new patterns — extend the existing `dark:` Tailwind variant convention and the established
`overflow-x` scroll-wrapper pattern (used today by tables, code blocks, KaTeX) to `InfoCard`.

## Backward compatibility

Purely presentational — every existing `StudyPackage` document (old or new) renders through the same
conditional (`v-if="c.field"`) guards already in place. No data migration, no regeneration needed.

## Files touched (implementation-plan level, not exhaustive)

- `client/src/style.css` — color remap, typography/spacing refinement, consolidate callout CSS.
- `client/src/components/ui/InfoCard.vue` — new.
- `client/src/pages/StudyPackagePage.vue` — replace inline callout markup with `InfoCard` usages, confirm
  section order.
- `client/src/components/CodeExample.vue`, `client/src/components/RichContent.vue` — visual polish only.

## Verification

No test suite exists in this repo. Verification is manual: run the dev server, open an existing generated
study package (at least one Programming-category and one non-Programming-category package, to confirm the
subject-adaptive rendering still behaves correctly), and visually confirm every card variant, formula
rendering, table, and code block in both light and dark mode, at desktop and mobile widths.
