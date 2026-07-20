# Premium Learning UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the generated Study Package reading experience (`StudyPackagePage.vue` and its component
family) to feel like a premium interactive textbook — consistent card language, a corrected color system,
and cleaner visual hierarchy — with zero backend/schema/prompt changes.

**Architecture:** Extract the repeated inline "callout" markup already used throughout
`StudyPackagePage.vue` into one reusable `InfoCard.vue` component, fix a real color collision in the
existing 7-variant callout system (Example and Exam-Important currently both effectively read as
warm/purple), and reorder each chapter's rendering to move examples/formulas/code before images/diagrams,
ending in the mistake/memory/exam-tip revision cluster.

**Tech Stack:** Vue 3 (`<script setup>`), Tailwind CSS v4 (`@theme` tokens in `style.css`), no build-time
CSS preprocessor beyond Tailwind, no test runner (verification is manual via the dev server).

## Global Constraints

- No new AI-generated fields, no prompt/schema/Mongoose model changes — every task in this plan touches
  `client/` only.
- No new hex color values — every new/changed color reuses an existing `--color-*` token from
  `client/src/style.css`'s `@theme` block.
- No behavior changes to `CodeExample.vue`'s run/copy/edit/disclosure logic — visual polish only.
- No test runner exists in this repo (`client/CLAUDE.md`: "no test runner, linter, or formatter
  configured") — every task's verification step is a manual check via the dev server (grep-based structural
  checks where a visual check isn't yet meaningful, full browser checks once a task's change is visible).
- Follow existing conventions: `dark:` Tailwind variant on every new/changed surface, `v-if`-guarded
  optional fields (never assume a field is present), Vue `<script setup>` with plain `defineProps` (no
  TypeScript).

---

## File Structure

- **Modify:** `client/src/style.css` — remap the `.callout-example` color, add a new `.callout-exam`
  variant, minor paragraph/list spacing refinement.
- **Create:** `client/src/components/ui/InfoCard.vue` — the new shared card primitive (icon + color variant
  + title + slot content), wrapping the (renamed/consolidated) callout CSS.
- **Modify:** `client/src/pages/StudyPackagePage.vue` — replace inline callout `<div>` blocks with
  `<InfoCard>` usages for `key_idea`/`easy_explanation`/`advanced_explanation`/`real_world_analogy`/
  `common_mistakes`/`memory_trick`/`exam_tip` (chapter card) and the Core Concepts tab's `memory_trick`
  block; upgrade the formula block to `InfoCard`; reorder chapter sections.
- **Modify:** `client/src/components/CodeExample.vue` — replace its inline `common_mistakes` callout with
  `InfoCard` for consistency.
- **Modify:** `client/src/components/RichContent.vue` — frame rendered Mermaid diagrams in a
  bordered/rounded card container, matching the existing image-figure treatment.

---

### Task 1: CSS foundation — color remap, new exam variant, spacing refinement

**Note on heading scale:** the design spec called for "a defined heading scale for h2/h3/h4 inside
generated content." Checking `client/src/composables/useMarkdown.js:187-188` shows generated Markdown
headings (`##`/`###`) are deliberately capped and rendered as `h5`/`h6` (`Math.min(level + 3, 6)`) — this is
intentional so a chapter's AI-written sub-headings never visually compete with the chapter's own `h4`
`topic_title`. `h5`/`h6` are already sized distinctly (`style.css:306-307`, 1.05em/1em). There is no h2/h3/h4
scale to define because generated content never produces those levels — no task changes heading sizing.

**Files:**
- Modify: `client/src/style.css:160-204` (callout comment + color rules), `client/src/style.css:284-290`
  (`.rich-content-block` paragraph/list spacing)

**Interfaces:**
- Produces: CSS classes `.callout-exam` / `.callout-exam .callout-label` (new), `.callout-example`
  redefined to use `--color-accent` instead of `--color-secondary`. `InfoCard.vue` (Task 2) will target
  these class names by variant name.

- [ ] **Step 1: Update the callout system comment and remap `.callout-example`/add `.callout-exam`**

Replace lines 160-204 of `client/src/style.css`:

```css
/* Callout boxes (definition/concept/example/mistake/warning/tip/exam/info) —
   shared by rich-content-block, prose-chat, and InfoCard.vue. One consistent
   color convention across the whole app: blue = definitions, green =
   concepts, cyan = examples, red = mistakes, orange = warnings, amber =
   tips, purple = exam-important, gray = additional info. Example was
   previously purple and exam-important didn't exist as its own variant
   (exam_tip reused the generic orange "warning" style) — cyan/purple were
   swapped so exam-important content gets a real, distinct identity instead
   of visually blending into ordinary warnings. */
.callout {
  display: flex;
  gap: 0.7em;
  border-radius: 0.85rem;
  border-width: 1.5px;
  border-style: solid;
  padding: 0.85em 1em;
  margin: 0.85em 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.callout-icon { flex-shrink: 0; font-size: 1.1em; line-height: 1.4; }
.callout-body :where(p) { margin: 0 0 0.4em; }
.callout-body :where(p:last-child) { margin-bottom: 0; }
.callout-label {
  display: block;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.72em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 0.3em;
  opacity: 0.85;
}
.callout-definition { background: color-mix(in srgb, #3b82f6 8%, transparent); border-color: color-mix(in srgb, #3b82f6 30%, transparent); }
.callout-definition .callout-label { color: #3b82f6; }
.callout-concept { background: color-mix(in srgb, var(--color-success) 8%, transparent); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); }
.callout-concept .callout-label { color: var(--color-success); }
.callout-example { background: color-mix(in srgb, var(--color-accent) 8%, transparent); border-color: color-mix(in srgb, var(--color-accent) 30%, transparent); }
.callout-example .callout-label { color: var(--color-accent); }
.callout-mistake { background: color-mix(in srgb, var(--color-danger) 8%, transparent); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); }
.callout-mistake .callout-label { color: var(--color-danger); }
.callout-warning { background: color-mix(in srgb, var(--color-warning) 10%, transparent); border-color: color-mix(in srgb, var(--color-warning) 35%, transparent); }
.callout-warning .callout-label { color: #92620a; }
.dark .callout-warning .callout-label { color: var(--color-warning); }
.callout-tip { background: color-mix(in srgb, #eab308 10%, transparent); border-color: color-mix(in srgb, #eab308 35%, transparent); }
.callout-tip .callout-label { color: #92720a; }
.dark .callout-tip .callout-label { color: #eab308; }
.callout-exam { background: color-mix(in srgb, var(--color-secondary) 8%, transparent); border-color: color-mix(in srgb, var(--color-secondary) 30%, transparent); }
.callout-exam .callout-label { color: var(--color-secondary); }
.callout-info { background: color-mix(in srgb, currentColor 6%, transparent); border-color: color-mix(in srgb, currentColor 18%, transparent); }
.callout-info .callout-label { color: rgb(100 116 139); }
.dark .callout-info .callout-label { color: rgb(148 163 184); }
```

- [ ] **Step 2: Tighten list-item spacing in `.rich-content-block`**

In `client/src/style.css`, find this block (around line 289-290):

```css
.rich-content-block :where(ul, ol) { margin: 0.5em 0 0.9em; padding-left: 1.4em; }
.rich-content-block :where(li) { margin-bottom: 0.4em; }
```

Replace with:

```css
.rich-content-block :where(ul, ol) { margin: 0.5em 0 0.9em; padding-left: 1.4em; }
.rich-content-block :where(li) { margin-bottom: 0.55em; line-height: 1.6; }
```

(Chapter `description` bodies are the longest-running text in the app — slightly looser list spacing
reduces visual density over a long study session without changing the font scale.)

- [ ] **Step 3: Verify the CSS is well-formed and the color swap is visible**

Run: `cd client && npm run dev` (or from repo root: `npm run dev`, which starts both client and server).

`real_world_analogy` already renders through `.callout-example` today
(`StudyPackagePage.vue:215`), so this CSS-only change is already visible: open any existing generated
study package's Summary tab in the browser and confirm the "Real-world analogy" box now renders in
**cyan**, not purple. If dark mode is active, toggle it and confirm the cyan box still reads clearly against
the dark background.

- [ ] **Step 4: Commit**

```bash
git add client/src/style.css
git commit -m "style: remap callout colors, add dedicated exam-important variant"
```

---

### Task 2: New shared `InfoCard.vue` component

**Files:**
- Create: `client/src/components/ui/InfoCard.vue`

**Interfaces:**
- Consumes: the `.callout`/`.callout-*` CSS classes from Task 1.
- Produces: `InfoCard` component with props `variant: "definition"|"concept"|"example"|"mistake"|"warning"|"tip"|"exam"|"info"` (required), `icon: String` (required, an emoji), `title: String` (required). Default slot renders the card body (may contain `v-html` paragraphs, lists, etc., exactly as the inline blocks it replaces did).

- [ ] **Step 1: Create the component**

```vue
<!-- client/src/components/ui/InfoCard.vue -->
<template>
  <div class="callout" :class="`callout-${variant}`">
    <div class="callout-icon">{{ icon }}</div>
    <div class="callout-body">
      <span class="callout-label">{{ title }}</span>
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    required: true,
    validator: (v) => ["definition", "concept", "example", "mistake", "warning", "tip", "exam", "info"].includes(v),
  },
  icon: { type: String, required: true },
  title: { type: String, required: true },
});
</script>
```

- [ ] **Step 2: Verify it compiles with no dev-server errors**

Run: `cd client && npm run dev` (skip if already running from Task 1).

Check the terminal/dev-server output for Vite compile errors on the new file — there's nothing rendering it
yet (that's Task 3), so this step only confirms the SFC itself is syntactically valid. No visual check is
meaningful until Task 3 wires it in.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ui/InfoCard.vue
git commit -m "feat: add shared InfoCard component for premium-field callouts"
```

---

### Task 3: Wire `InfoCard` into the chapter card's premium fields

**Files:**
- Modify: `client/src/pages/StudyPackagePage.vue:188-221` (chapter card: key_idea, easy/advanced
  explanation, real_world_analogy), `client/src/pages/StudyPackagePage.vue:263-287` (common_mistakes,
  memory_trick, exam_tip), `client/src/pages/StudyPackagePage.vue:307-313` (Core Concepts tab memory_trick),
  `client/src/pages/StudyPackagePage.vue:555-556` (import)

**Interfaces:**
- Consumes: `InfoCard` from `../components/ui/InfoCard.vue` (Task 2).

- [ ] **Step 1: Import `InfoCard`**

In `client/src/pages/StudyPackagePage.vue`, find (around line 555-556):

```js
import Modal from "../components/ui/Modal.vue";
import EmptyState from "../components/ui/EmptyState.vue";
```

Replace with:

```js
import Modal from "../components/ui/Modal.vue";
import EmptyState from "../components/ui/EmptyState.vue";
import InfoCard from "../components/ui/InfoCard.vue";
```

- [ ] **Step 2: Replace `key_idea`, `easy_explanation`/`advanced_explanation`, `real_world_analogy`**

Find (lines 188-221):

```html
                    <div v-if="c.key_idea" class="callout callout-concept mb-4">
                      <div class="callout-icon">💡</div>
                      <div class="callout-body">
                        <span class="callout-label">{{ t("studyPackage.chapter.keyIdea") }}</span>
                        <p class="font-semibold" v-html="renderLatexText(c.key_idea)"></p>
                      </div>
                    </div>

                    <div class="rich-content-block text-base text-slate-700 dark:text-slate-200 leading-loose mb-3" v-html="renderMarkdown(c.description)"></div>

                    <div v-if="c.easy_explanation || c.advanced_explanation" class="grid sm:grid-cols-2 gap-3 mb-4">
                      <div v-if="c.easy_explanation" class="callout callout-info">
                        <div class="callout-icon">🌱</div>
                        <div class="callout-body">
                          <span class="callout-label">{{ t("studyPackage.chapter.easyExplanation") }}</span>
                          <p v-html="renderLatexText(c.easy_explanation)"></p>
                        </div>
                      </div>
                      <div v-if="c.advanced_explanation" class="callout callout-definition">
                        <div class="callout-icon">🎓</div>
                        <div class="callout-body">
                          <span class="callout-label">{{ t("studyPackage.chapter.advancedExplanation") }}</span>
                          <p v-html="renderLatexText(c.advanced_explanation)"></p>
                        </div>
                      </div>
                    </div>

                    <div v-if="c.real_world_analogy" class="callout callout-example mb-4">
                      <div class="callout-icon">🌍</div>
                      <div class="callout-body">
                        <span class="callout-label">{{ t("studyPackage.chapter.realWorldAnalogy") }}</span>
                        <p v-html="renderLatexText(c.real_world_analogy)"></p>
                      </div>
                    </div>
```

Replace with:

```html
                    <InfoCard v-if="c.key_idea" variant="concept" icon="💡" :title="t('studyPackage.chapter.keyIdea')" class="mb-4">
                      <p class="font-semibold" v-html="renderLatexText(c.key_idea)"></p>
                    </InfoCard>

                    <div class="rich-content-block text-base text-slate-700 dark:text-slate-200 leading-loose mb-3" v-html="renderMarkdown(c.description)"></div>

                    <div v-if="c.easy_explanation || c.advanced_explanation" class="grid sm:grid-cols-2 gap-3 mb-4">
                      <InfoCard v-if="c.easy_explanation" variant="info" icon="🌱" :title="t('studyPackage.chapter.easyExplanation')">
                        <p v-html="renderLatexText(c.easy_explanation)"></p>
                      </InfoCard>
                      <InfoCard v-if="c.advanced_explanation" variant="definition" icon="🎓" :title="t('studyPackage.chapter.advancedExplanation')">
                        <p v-html="renderLatexText(c.advanced_explanation)"></p>
                      </InfoCard>
                    </div>

                    <InfoCard v-if="c.real_world_analogy" variant="example" icon="🌍" :title="t('studyPackage.chapter.realWorldAnalogy')" class="mb-4">
                      <p v-html="renderLatexText(c.real_world_analogy)"></p>
                    </InfoCard>
```

- [ ] **Step 3: Replace `common_mistakes`, `memory_trick`, `exam_tip`**

Find (lines 263-287, note `exam_tip` switches from `callout-warning`/`class="callout callout-warning"` with
no margin utility to the new `exam` variant):

```html
                    <div v-if="c.common_mistakes?.length" class="callout callout-mistake mb-3">
                      <div class="callout-icon">❌</div>
                      <div class="callout-body">
                        <span class="callout-label">{{ t("studyPackage.chapter.commonMistakes") }}</span>
                        <ul class="list-disc list-inside space-y-1">
                          <li v-for="x in c.common_mistakes" :key="x" v-html="renderLatexText(x)"></li>
                        </ul>
                      </div>
                    </div>

                    <div v-if="c.memory_trick" class="callout callout-tip mb-3">
                      <div class="callout-icon">🧠</div>
                      <div class="callout-body">
                        <span class="callout-label">{{ t("studyPackage.chapter.memoryTrick") }}</span>
                        <p v-html="renderLatexText(c.memory_trick)"></p>
                      </div>
                    </div>

                    <div v-if="c.exam_tip" class="callout callout-warning">
                      <div class="callout-icon">🎯</div>
                      <div class="callout-body">
                        <span class="callout-label">{{ t("studyPackage.chapter.examTip") }}</span>
                        <p v-html="renderLatexText(c.exam_tip)"></p>
                      </div>
                    </div>
```

Replace with:

```html
                    <InfoCard v-if="c.common_mistakes?.length" variant="mistake" icon="❌" :title="t('studyPackage.chapter.commonMistakes')" class="mb-3">
                      <ul class="list-disc list-inside space-y-1">
                        <li v-for="x in c.common_mistakes" :key="x" v-html="renderLatexText(x)"></li>
                      </ul>
                    </InfoCard>

                    <InfoCard v-if="c.memory_trick" variant="tip" icon="🧠" :title="t('studyPackage.chapter.memoryTrick')" class="mb-3">
                      <p v-html="renderLatexText(c.memory_trick)"></p>
                    </InfoCard>

                    <InfoCard v-if="c.exam_tip" variant="exam" icon="🎯" :title="t('studyPackage.chapter.examTip')">
                      <p v-html="renderLatexText(c.exam_tip)"></p>
                    </InfoCard>
```

- [ ] **Step 4: Replace the Core Concepts tab's `memory_trick` block**

Find (lines 307-313):

```html
                <div v-if="c.memory_trick" class="callout callout-tip mt-3">
                  <div class="callout-icon">🧠</div>
                  <div class="callout-body">
                    <span class="callout-label">{{ t("studyPackage.chapter.memoryTrick") }}</span>
                    <p v-html="renderLatexText(c.memory_trick)"></p>
                  </div>
                </div>
```

Replace with:

```html
                <InfoCard v-if="c.memory_trick" variant="tip" icon="🧠" :title="t('studyPackage.chapter.memoryTrick')" class="mt-3">
                  <p v-html="renderLatexText(c.memory_trick)"></p>
                </InfoCard>
```

- [ ] **Step 5: Sanity-check no orphaned inline callout markup remains for these seven fields**

Run: `grep -n "callout-concept\|callout-info\|callout-definition\|callout-example\|callout-mistake\|callout-tip\|callout-warning" client/src/pages/StudyPackagePage.vue`

Expected: no matches (all inline `class="callout callout-*"` usages in this file are now `InfoCard`
components). If `useMarkdown.js`-generated inline callouts appear elsewhere via `v-html`, those are
generated HTML strings, not template matches, and are unaffected by this grep — that's expected and correct
(they still use the same, now-remapped, CSS classes at render time).

- [ ] **Step 6: Visual verification**

Run: `npm run dev` from the repo root (if not already running). Open an existing Programming-category study
package's Summary tab. Confirm: the key-idea, easy/advanced explanation, real-world-analogy,
common-mistakes, memory-trick, and exam-tip boxes all render identically to before **except** exam-tip is
now **purple** instead of orange, and real-world-analogy is **cyan** instead of purple. Toggle dark mode and
confirm all six cards still read clearly. Open the Concepts tab and confirm memory-trick boxes there also
render correctly.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/StudyPackagePage.vue
git commit -m "refactor: wire InfoCard into chapter and concepts premium fields"
```

---

### Task 4: Upgrade the formula block to `InfoCard`

**Files:**
- Modify: `client/src/pages/StudyPackagePage.vue:233-241`

**Interfaces:**
- Consumes: `InfoCard` (already imported in Task 3).

- [ ] **Step 1: Replace the plain dashed-border formula box**

Find (lines 233-241):

```html
                    <div v-if="c.formulas?.length" class="flex flex-col gap-3 mb-4">
                      <div v-for="(f, fi) in c.formulas" :key="fi" class="rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-border-dark p-4">
                        <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">{{ f.name }}</p>
                        <div class="text-lg text-slate-900 dark:text-white my-2" v-html="renderBlockFormula(f.formula)"></div>
                        <p class="text-sm text-slate-500 dark:text-slate-400" v-html="renderLatexText(f.variables)"></p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.whenToUse") }}</strong> <span v-html="renderLatexText(f.when_to_use)"></span></p>
                        <p v-if="f.example" class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(f.example)"></span></p>
                      </div>
                    </div>
```

Replace with:

```html
                    <div v-if="c.formulas?.length" class="flex flex-col gap-3 mb-4">
                      <InfoCard v-for="(f, fi) in c.formulas" :key="fi" variant="definition" icon="📐" :title="f.name">
                        <div class="text-lg text-slate-900 dark:text-white my-2" v-html="renderBlockFormula(f.formula)"></div>
                        <p class="text-sm text-slate-500 dark:text-slate-400" v-html="renderLatexText(f.variables)"></p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.whenToUse") }}</strong> <span v-html="renderLatexText(f.when_to_use)"></span></p>
                        <p v-if="f.example" class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(f.example)"></span></p>
                      </InfoCard>
                    </div>
```

(Formula name becomes the card title via the `title` prop, matching how every other premium field's label
works — no new i18n key needed since `f.name` is already a self-describing AI-generated string, e.g.
"Quadratic Formula".)

- [ ] **Step 2: Visual verification**

Open a Mathematics/Physics-category study package's Summary tab (or any package whose chapters have
`formulas`). Confirm each formula now renders in a blue-tinted definition card with a 📐 icon and the
formula name as the card title, instead of the old plain dashed gray box. Confirm the formula itself (KaTeX)
still renders correctly and long formulas still scroll horizontally via `.katex-display-wrap` rather than
overflowing the card.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/StudyPackagePage.vue
git commit -m "style: upgrade formula blocks to InfoCard for visual parity with other premium fields"
```

---

### Task 5: Reorder chapter sections — examples/formulas/code before images/diagrams

**Files:**
- Modify: `client/src/pages/StudyPackagePage.vue:223-261` (the block spanning images through key_points)

**Interfaces:**
- None new — pure reordering of existing `v-if`/`v-for` blocks, no prop/behavior changes.

- [ ] **Step 1: Reorder the block**

Find the current sequence (lines 223-261, immediately after the `real_world_analogy` `InfoCard` from Task
3 and before `common_mistakes`):

```html
                    <div v-if="c.images?.length" class="flex flex-col gap-4 mb-4">
                      <figure v-for="(img, ii) in c.images" :key="ii" class="rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <img :src="img.data" :alt="img.caption" class="w-full max-h-96 object-contain bg-slate-50 dark:bg-white/5" loading="lazy" />
                        <figcaption class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          <p class="font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ img.caption }}</p>
                          <p class="leading-relaxed" v-html="renderLatexText(img.explanation)"></p>
                        </figcaption>
                      </figure>
                    </div>

                    <div v-if="c.formulas?.length" class="flex flex-col gap-3 mb-4">
                      <InfoCard v-for="(f, fi) in c.formulas" :key="fi" variant="definition" icon="📐" :title="f.name">
                        <div class="text-lg text-slate-900 dark:text-white my-2" v-html="renderBlockFormula(f.formula)"></div>
                        <p class="text-sm text-slate-500 dark:text-slate-400" v-html="renderLatexText(f.variables)"></p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.whenToUse") }}</strong> <span v-html="renderLatexText(f.when_to_use)"></span></p>
                        <p v-if="f.example" class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(f.example)"></span></p>
                      </InfoCard>
                    </div>

                    <ul v-if="c.algorithms_or_processes?.length" class="list-decimal list-inside text-base space-y-2 text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      <li v-for="x in c.algorithms_or_processes" :key="x" v-html="renderLatexText(x)"></li>
                    </ul>
                    <div v-for="x in c.diagrams_or_tables_explained" :key="x" class="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                      <span class="mr-1">📊</span><RichContent :text="x" />
                    </div>
                    <p v-for="x in c.code_explained" :key="x" class="text-sm font-mono text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">💻 <span v-html="renderLatexText(x)"></span></p>

                    <div v-if="c.code_examples?.length" class="mb-4">
                      <CodeExample v-for="(ex, exi) in c.code_examples" :key="exi" :example="ex" />
                    </div>

                    <div v-if="c.examples?.length" class="flex flex-col gap-2 mb-3">
                      <p v-for="x in c.examples" :key="x" class="text-sm text-slate-600 dark:text-slate-300 bg-primary/5 rounded-lg px-4 py-3 leading-relaxed"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(x)"></span></p>
                    </div>

                    <ul class="list-disc list-inside text-base text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed mb-4">
                      <li v-for="k in c.key_points" :key="k" v-html="renderLatexText(k)"></li>
                    </ul>
```

Replace with (formulas/algorithms/code/examples first, then images/diagrams, then key_points — matches the
spec's "explanation → formulas/examples/code → images/diagrams → mistakes/revision" reading order):

```html
                    <div v-if="c.formulas?.length" class="flex flex-col gap-3 mb-4">
                      <InfoCard v-for="(f, fi) in c.formulas" :key="fi" variant="definition" icon="📐" :title="f.name">
                        <div class="text-lg text-slate-900 dark:text-white my-2" v-html="renderBlockFormula(f.formula)"></div>
                        <p class="text-sm text-slate-500 dark:text-slate-400" v-html="renderLatexText(f.variables)"></p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.whenToUse") }}</strong> <span v-html="renderLatexText(f.when_to_use)"></span></p>
                        <p v-if="f.example" class="text-sm text-slate-500 dark:text-slate-400 mt-1.5"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(f.example)"></span></p>
                      </InfoCard>
                    </div>

                    <ul v-if="c.algorithms_or_processes?.length" class="list-decimal list-inside text-base space-y-2 text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                      <li v-for="x in c.algorithms_or_processes" :key="x" v-html="renderLatexText(x)"></li>
                    </ul>
                    <p v-for="x in c.code_explained" :key="x" class="text-sm font-mono text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">💻 <span v-html="renderLatexText(x)"></span></p>

                    <div v-if="c.code_examples?.length" class="mb-4">
                      <CodeExample v-for="(ex, exi) in c.code_examples" :key="exi" :example="ex" />
                    </div>

                    <div v-if="c.examples?.length" class="flex flex-col gap-2 mb-3">
                      <p v-for="x in c.examples" :key="x" class="text-sm text-slate-600 dark:text-slate-300 bg-primary/5 rounded-lg px-4 py-3 leading-relaxed"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(x)"></span></p>
                    </div>

                    <div v-if="c.images?.length" class="flex flex-col gap-4 mb-4">
                      <figure v-for="(img, ii) in c.images" :key="ii" class="rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <img :src="img.data" :alt="img.caption" class="w-full max-h-96 object-contain bg-slate-50 dark:bg-white/5" loading="lazy" />
                        <figcaption class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          <p class="font-semibold text-slate-700 dark:text-slate-300 mb-1">{{ img.caption }}</p>
                          <p class="leading-relaxed" v-html="renderLatexText(img.explanation)"></p>
                        </figcaption>
                      </figure>
                    </div>

                    <div v-for="x in c.diagrams_or_tables_explained" :key="x" class="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                      <span class="mr-1">📊</span><RichContent :text="x" />
                    </div>

                    <ul class="list-disc list-inside text-base text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed mb-4">
                      <li v-for="k in c.key_points" :key="k" v-html="renderLatexText(k)"></li>
                    </ul>
```

- [ ] **Step 2: Sanity-check nothing was dropped**

Run: `grep -c "c\.images\|c\.formulas\|c\.algorithms_or_processes\|c\.diagrams_or_tables_explained\|c\.code_explained\|c\.code_examples\|c\.examples\|c\.key_points" client/src/pages/StudyPackagePage.vue`

Expected: the same total count as before this edit (each field reference still appears exactly once in the
chapter card — this only confirms nothing was accidentally duplicated or deleted during the reorder, not
that the order itself is correct).

- [ ] **Step 3: Visual verification**

Open a Programming-category package with a chapter that has both `code_examples` and `images` — confirm the
code playground now renders before any chapter images, and images/diagrams render before the closing
common-mistakes/memory-trick/exam-tip cluster. Open a Mathematics package with `formulas` and confirm
formulas render immediately after the real-world-analogy card, ahead of images.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/StudyPackagePage.vue
git commit -m "refactor: reorder chapter sections to examples/formulas/code before images/diagrams"
```

---

### Task 6: `CodeExample.vue` — consistent card styling for common mistakes

**Files:**
- Modify: `client/src/components/CodeExample.vue:48-56`, `client/src/components/CodeExample.vue:71-77`
  (imports)

**Interfaces:**
- Consumes: `InfoCard` from `../components/ui/InfoCard.vue`.

- [ ] **Step 1: Import `InfoCard`**

Find (line 74, in the `<script setup>` imports):

```js
import { renderLatexText } from "../composables/useLatex.js";
```

Replace with:

```js
import { renderLatexText } from "../composables/useLatex.js";
import InfoCard from "./ui/InfoCard.vue";
```

- [ ] **Step 2: Replace the inline common-mistakes callout**

Find (lines 48-56):

```html
      <div v-if="example.common_mistakes?.length" class="callout callout-mistake">
        <div class="callout-icon">❌</div>
        <div class="callout-body">
          <span class="callout-label">{{ t("studyPackage.chapter.commonMistakes") }}</span>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="x in example.common_mistakes" :key="x" v-html="renderLatexText(x)"></li>
          </ul>
        </div>
      </div>
```

Replace with:

```html
      <InfoCard v-if="example.common_mistakes?.length" variant="mistake" icon="❌" :title="t('studyPackage.chapter.commonMistakes')">
        <ul class="list-disc list-inside space-y-1">
          <li v-for="x in example.common_mistakes" :key="x" v-html="renderLatexText(x)"></li>
        </ul>
      </InfoCard>
```

- [ ] **Step 3: Visual verification**

Open a Programming-category package with at least one code example that has `common_mistakes` populated.
Confirm the common-mistakes box inside the code playground still renders identically (red-tinted callout,
❌ icon, same list content) — this is a pure refactor to the shared component, so there should be zero
visible difference except now sharing implementation with the chapter-level version.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/CodeExample.vue
git commit -m "refactor: use InfoCard for CodeExample's common-mistakes block"
```

---

### Task 7: `RichContent.vue` — frame Mermaid diagrams in a card container

**Files:**
- Modify: `client/src/components/RichContent.vue`

**Interfaces:**
- None new — wraps the existing `MermaidDiagram` usage in a styling container, same props/behavior.

- [ ] **Step 1: Add a framed wrapper around rendered diagrams**

Replace the full contents of `client/src/components/RichContent.vue`:

```vue
<template>
  <template v-for="(seg, i) in segments" :key="i">
    <div v-if="seg.type === 'mermaid'" class="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark p-4 my-3 overflow-x-auto">
      <MermaidDiagram :code="seg.content" />
    </div>
    <div v-else class="rich-content-block" v-html="renderMarkdown(seg.content)"></div>
  </template>
</template>

<script setup>
import { computed } from "vue";
import { renderMarkdown } from "../composables/useMarkdown.js";
import { splitMermaidSegments } from "../composables/useMermaid.js";
import MermaidDiagram from "./MermaidDiagram.vue";

const props = defineProps({ text: { type: String, default: "" } });
const segments = computed(() => splitMermaidSegments(props.text));
</script>
```

(This mirrors the existing image-figure framing — `rounded-xl`/`rounded-2xl border ... overflow` — already
used at `StudyPackagePage.vue`'s image block, so diagrams now visually match every other "visual" card
instead of rendering bare against the page background. `overflow-x-auto` on the wrapper covers wide diagrams
the same way `.katex-display-wrap` covers wide formulas.)

- [ ] **Step 2: Visual verification**

Open a Computer Science Theory package with a chapter containing a Mermaid diagram (e.g. an automaton or
tree diagram in `diagrams_or_tables_explained`). Confirm the diagram now renders inside a bordered, rounded
card matching the app's card language, and that a wide diagram scrolls horizontally inside its own card
instead of overflowing the page. Confirm non-Mermaid `RichContent` usages (plain markdown segments) are
unaffected.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RichContent.vue
git commit -m "style: frame Mermaid diagrams in a bordered card for visual consistency"
```

---

### Task 8: Final cross-cutting visual QA

**Files:** none (verification-only task).

- [ ] **Step 1: Light mode desktop sweep**

Run: `npm run dev` from the repo root. In the browser at desktop width (1280px+), open:
- A **Programming** or **Computer Science Theory** package: confirm code playground ordering (Task 5),
  common-mistakes card parity between chapter-level and code-example-level (Task 6), and any Mermaid
  diagrams are framed (Task 7).
- A **Mathematics** or **Physics** package: confirm formula cards (Task 4) render correctly with KaTeX.
- A package from a **non-technical** subject (History/Business/Law/Medicine/etc., or any package with no
  `code_examples`/`formulas`): confirm no empty/broken card renders where those fields are absent — the
  `v-if` guards should mean those sections simply don't appear, per the existing "never assume a field is
  present" rule.

- [ ] **Step 2: Dark mode sweep**

Toggle dark mode (theme store toggle in the app header) and repeat the same three package checks. Confirm
every `InfoCard` variant (all 8 colors) remains legible against the dark background, and the new Mermaid
diagram frame (Task 7) doesn't clash with dark-mode diagram rendering.

- [ ] **Step 3: Mobile width sweep**

Resize the browser (or use device emulation) to ~375px width. Confirm: no `InfoCard` overflows horizontally,
the formula cards' KaTeX content scrolls inside `.katex-display-wrap` rather than breaking layout, code
playground and diagram cards scroll horizontally rather than overflowing the viewport, and the two-column
`easy_explanation`/`advanced_explanation` grid collapses to one column.

- [ ] **Step 4: Console check**

Check the browser console for errors on each package opened in Steps 1-3 (Vue warnings about missing props,
failed `InfoCard` variant validation, etc.). Fix any that appear before proceeding.

- [ ] **Step 5: Final commit (if Step 4 required fixes)**

```bash
git add client/src/
git commit -m "fix: address visual QA findings from premium UI redesign sweep"
```

(Skip this step entirely if Step 4 found nothing to fix.)
