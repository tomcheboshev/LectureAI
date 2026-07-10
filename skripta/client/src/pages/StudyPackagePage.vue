<template>
  <div v-if="loading" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="skeleton h-8 w-1/2 rounded mb-3"></div>
    <div class="skeleton h-4 w-2/3 rounded mb-8"></div>
    <div class="skeleton h-64 w-full rounded-2xl"></div>
  </div>

  <div v-else-if="error" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <div class="rounded-2xl border border-danger/30 bg-danger/5 text-danger p-6">{{ error }}</div>
  </div>

  <!-- Generation still in progress (async background job) -->
  <div v-else-if="pkg && pkg.status === 'failed'" class="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
    <span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-danger/10 text-danger mb-5">
      <ExclamationTriangleIcon class="w-7 h-7" />
    </span>
    <h1 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">{{ t("studyPackage.failed.title") }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ pkg.generationError || t("studyPackage.failed.defaultMessage") }}</p>
    <div class="flex items-center justify-center gap-3">
      <RouterLink to="/new" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition">{{ t("studyPackage.failed.tryAgain") }}</RouterLink>
      <button class="inline-flex items-center gap-2 rounded-xl border-2 border-danger/30 text-danger px-5 py-2.5 text-sm font-semibold hover:bg-danger/10 transition" @click="remove">
        <TrashIcon class="w-4 h-4" /> {{ t("common.delete") }}
      </button>
    </div>
  </div>

  <div v-else-if="pkg && pkg.status !== 'completed'" class="max-w-lg mx-auto px-4 sm:px-6 py-20 text-center">
    <div class="relative w-20 h-20 mb-8 mx-auto">
      <div class="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-secondary to-accent opacity-30 animate-ping"></div>
      <div class="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white animate-float">
        <SparklesIcon class="w-9 h-9" />
      </div>
    </div>
    <h1 class="font-display font-bold text-xl text-slate-900 dark:text-white mb-2">{{ progressStepLabel }}</h1>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">{{ pkg.metadata?.video_title && pkg.metadata.video_title !== "Generating…" ? pkg.metadata.video_title : t("studyPackage.progress.buildingDefault") }}</p>
    <div class="max-w-xs mx-auto">
      <div class="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700" :style="{ width: (pkg.progress ?? 0) + '%' }"></div>
      </div>
      <p class="text-xs font-mono text-slate-400 mt-2">{{ pkg.progress ?? 0 }}%</p>
    </div>
  </div>

  <div v-else-if="pkg" class="max-w-6xl mx-auto px-4 sm:px-6 py-8">
    <RouterLink to="/dashboard" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary transition mb-3">
      <ArrowLeftIcon class="w-4 h-4" /> {{ t("studyPackage.backToDashboard") }}
    </RouterLink>

    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white">{{ pkg.metadata.video_title }}</h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 mb-3">{{ pkg.metadata.short_description }}</p>
        <div class="flex flex-wrap gap-1.5">
          <span class="badge badge-primary">{{ pkg.metadata.subject }}</span>
          <span class="badge">{{ pkg.metadata.estimated_level }}</span>
          <span class="badge">{{ pkg.metadata.content_type }}</span>
          <span class="badge">{{ t("studyPackage.header.duration", { minutes: pkg.metadata.estimated_duration_minutes }) }}</span>
          <span class="badge">{{ t("studyPackage.header.transcriptQuality", { quality: pkg.metadata.transcript_quality }) }}</span>
          <span v-if="pkg.source?.type === 'youtube'" class="badge badge-danger">
            <VideoCameraIcon class="w-3 h-3 mr-1" /> {{ pkg.source.channel || "YouTube" }}
          </span>
          <span v-else-if="pkg.source?.type === 'pdf'" class="badge">
            <DocumentIcon class="w-3 h-3 mr-1" /> {{ pkg.source.filename || "PDF" }}
          </span>
          <span v-else-if="pkg.source?.type === 'docx'" class="badge">
            <DocumentIcon class="w-3 h-3 mr-1" /> {{ pkg.source.filename || "DOCX" }}
          </span>
          <span v-else-if="pkg.sources?.length" class="badge">
            <DocumentIcon class="w-3 h-3 mr-1" /> {{ t("studyPackage.header.sourceCount", { count: pkg.sources.length }) }}
          </span>
        </div>
        <p v-if="pkg.sources?.length > 1" class="text-xs text-slate-400 mt-2">
          {{ orderedSourceFilenames.join(" · ") }}
        </p>
      </div>
      <div class="shrink-0 flex items-center gap-2">
        <div class="relative" ref="exportMenuRef">
          <button class="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-200 dark:border-border-dark px-3.5 py-2 text-sm font-semibold hover:border-slate-400 transition" @click="exportOpen = !exportOpen">
            <ArrowDownTrayIcon class="w-4 h-4" /> {{ t("studyPackage.export.button") }}
          </button>
          <Transition name="fade">
            <div v-if="exportOpen" class="absolute right-0 top-11 z-20 w-52 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark shadow-lg py-1.5">
              <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('md')">{{ t("studyPackage.export.markdown") }}</button>
              <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('json')">{{ t("studyPackage.export.json") }}</button>
              <button class="w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition" @click="doExport('print')">{{ t("studyPackage.export.print") }}</button>
              <p v-if="!auth.isPro" class="px-3.5 pt-1.5 text-[11px] text-slate-400 border-t border-slate-100 dark:border-border-dark mt-1">{{ t("studyPackage.export.watermarkNote") }}</p>
            </div>
          </Transition>
        </div>
        <button class="inline-flex items-center gap-1.5 rounded-lg border-2 border-danger/30 text-danger px-3.5 py-2 text-sm font-semibold hover:bg-danger/10 transition" @click="confirmDelete = true">
          <TrashIcon class="w-4 h-4" /> {{ t("common.delete") }}
        </button>
      </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Tab nav -->
      <nav class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:w-56 shrink-0 pb-1 lg:pb-0 lg:sticky lg:top-20 lg:self-start">
        <button
          v-for="tabItem in tabs"
          :key="tabItem.id"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition"
          :class="tab === tabItem.id ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'"
          @click="tab = tabItem.id"
        >
          <component :is="tabItem.icon" class="w-4.5 h-4.5 shrink-0" />
          {{ t(tabItem.labelKey) }}
        </button>
      </nav>

      <!-- Tab content -->
      <!--
        Every pane below uses v-show (not v-if/v-else-if) so switching tabs
        never unmounts a pane's component tree — QuizPlayer/FlashcardDeck/
        TrueFalseQuiz/ConceptExplainer/ChatPanel all keep their in-progress
        state (current question, learned cards, chat history, fetched
        explanations) when the student glances at another tab and comes
        back, instead of resetting on every revisit.
      -->
      <div class="flex-1 min-w-0">
          <!-- SUMMARY -->
          <div v-show="tab === 'summary'" class="flex flex-col gap-5">
            <YouTubePlayer v-if="youtubeVideoId" ref="youtubePlayer" :video-id="youtubeVideoId" />
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">{{ t("studyPackage.summary.fullSummaryTitle") }}</h3>
              <p class="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{{ pkg.full_lecture_summary }}</p>
            </div>
            <div class="flex items-center justify-between">
              <h3 class="font-display font-bold text-lg">{{ t("studyPackage.summary.chaptersTitle") }}</h3>
              <RegenerateButton :package-id="pkg._id" section="summary" @regenerated="(d) => (pkg.summary = d.summary)" />
            </div>
            <div class="flex flex-col gap-6">
              <div v-for="group in summaryGroups" :key="group.title || 'single'">
                <button
                  v-if="group.title"
                  type="button"
                  class="w-full flex items-center gap-3 py-1.5 mb-3 text-left"
                  @click="toggleGroup(group.title)"
                >
                  <ChevronRightIcon class="w-4 h-4 text-slate-400 transition-transform shrink-0" :class="!closedGroups.has(group.title) ? 'rotate-90' : ''" />
                  <span class="badge badge-primary shrink-0">{{ group.title }}</span>
                  <span class="h-px flex-1 bg-slate-200 dark:bg-border-dark"></span>
                  <span class="text-xs text-slate-400 shrink-0">{{ t("studyPackage.summary.chapterCount", { count: group.chapters.length }) }}</span>
                </button>

                <div
                  v-show="!group.title || !closedGroups.has(group.title)"
                  class="relative flex flex-col gap-6 pl-6 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-border-dark"
                >
                  <div v-for="(c, ci) in group.chapters" :key="ci" class="relative">
                    <span class="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary/15"></span>
                    <button
                      v-if="youtubeVideoId"
                      class="font-mono text-xs text-primary mb-0.5 underline underline-offset-2 hover:text-primary-hover"
                      @click="youtubePlayer?.seekTo(c.timestamp)"
                    >
                      {{ formatTs(c.timestamp) }} ▶
                    </button>
                    <p v-else class="font-mono text-xs text-primary mb-0.5">{{ formatTs(c.timestamp) }}</p>
                    <h4 class="font-display font-bold text-slate-900 dark:text-white mb-1.5">{{ c.topic_title }}</h4>
                    <p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed mb-2" v-html="renderLatexText(c.description)"></p>

                    <div v-if="c.formulas?.length" class="flex flex-col gap-2 mb-3">
                      <div v-for="(f, fi) in c.formulas" :key="fi" class="rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-border-dark p-3">
                        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ f.name }}</p>
                        <div class="text-base text-slate-900 dark:text-white my-1.5" v-html="renderBlockFormula(f.formula)"></div>
                        <p class="text-xs text-slate-500 dark:text-slate-400" v-html="renderLatexText(f.variables)"></p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1"><strong>{{ t("studyPackage.formulas.whenToUse") }}</strong> <span v-html="renderLatexText(f.when_to_use)"></span></p>
                        <p v-if="f.example" class="text-xs text-slate-500 dark:text-slate-400 mt-1"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(f.example)"></span></p>
                      </div>
                    </div>

                    <ul v-if="c.algorithms_or_processes?.length" class="list-decimal list-inside text-sm space-y-1 text-slate-600 dark:text-slate-300 mb-2">
                      <li v-for="x in c.algorithms_or_processes" :key="x">{{ x }}</li>
                    </ul>
                    <div v-for="x in c.diagrams_or_tables_explained" :key="x" class="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span class="mr-1">📊</span><RichContent :text="x" />
                    </div>
                    <p v-for="x in c.code_explained" :key="x" class="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">💻 {{ x }}</p>
                    <div v-if="c.examples?.length" class="flex flex-col gap-1 mb-2">
                      <p v-for="x in c.examples" :key="x" class="text-xs text-slate-600 dark:text-slate-300 bg-primary/5 rounded-lg px-3 py-2"><strong>{{ t("studyPackage.formulas.example") }}</strong> <span v-html="renderLatexText(x)"></span></p>
                    </div>

                    <ul class="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <li v-for="k in c.key_points" :key="k">{{ k }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- CONCEPTS -->
          <div v-show="tab === 'concepts'" class="flex flex-col gap-4">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="core_concepts" @regenerated="(d) => (pkg.core_concepts = d.core_concepts)" />
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div v-for="c in pkg.core_concepts" :key="c.term" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold text-primary mb-1.5">{{ c.term }}</h3>
                <p class="text-sm text-slate-700 dark:text-slate-200 mb-2" v-html="renderLatexText(c.definition)"></p>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-2"><strong class="text-slate-600 dark:text-slate-300">{{ t("studyPackage.concepts.whyItMatters") }}</strong> <span v-html="renderLatexText(c.why_it_matters)"></span></p>
                <p v-if="c.common_mistakes" class="text-sm text-danger/90 mb-2"><strong>{{ t("studyPackage.concepts.commonMistake") }}</strong> <span v-html="renderLatexText(c.common_mistakes)"></span></p>
                <p class="font-mono text-xs bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400" v-html="renderLatexText(c.example)"></p>
                <p v-if="c.related_concepts?.length" class="text-xs font-mono text-slate-400 mt-2">{{ t("studyPackage.concepts.related") }} {{ c.related_concepts.join(", ") }}</p>
                <ConceptExplainer :package-id="pkg._id" :term="c.term" :definition="c.definition" />
              </div>
            </div>
          </div>

          <!-- NOTES -->
          <div v-show="tab === 'notes'" class="flex flex-col gap-4">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="study_notes" @regenerated="(d) => (pkg.study_notes = d.study_notes)" />
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.mainIdeas") }}</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.main_ideas" :key="x">{{ x }}</li></ul>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.importantDetails") }}</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.important_details" :key="x">{{ x }}</li></ul>
              </div>
              <div v-if="notes.formulas_or_rules?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.formulasRules") }}</h3>
                <ul class="list-none space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li v-for="x in notes.formulas_or_rules" :key="x" v-html="renderLatexText(x)"></li>
                </ul>
              </div>
              <div v-if="notes.processes_or_steps?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.processesSteps") }}</h3>
                <ol class="list-decimal list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.processes_or_steps" :key="x">{{ x }}</li></ol>
              </div>
              <div v-if="notes.comparisons?.length" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 sm:col-span-2">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.comparisons") }}</h3>
                <p v-for="(c, i) in notes.comparisons" :key="i" class="text-sm text-slate-600 dark:text-slate-300 mb-1">
                  <strong class="text-slate-900 dark:text-white">{{ c.concept_a }}</strong> {{ t("studyPackage.notes.vs") }} <strong class="text-slate-900 dark:text-white">{{ c.concept_b }}</strong>: {{ c.difference }}
                </p>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
                <h3 class="font-display font-bold mb-2">{{ t("studyPackage.notes.commonMistakes") }}</h3>
                <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="x in notes.common_misunderstandings" :key="x">{{ x }}</li></ul>
              </div>
            </div>
            <div class="rounded-2xl border-2 border-warning/40 bg-warning/5 p-5">
              <h3 class="font-display font-bold mb-2 flex items-center gap-2"><FireIcon class="w-5 h-5 text-warning" /> {{ t("studyPackage.notes.examFocus") }}</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-700 dark:text-slate-200"><li v-for="x in notes.exam_focus" :key="x">{{ x }}</li></ul>
            </div>
          </div>

          <!-- GLOSSARY -->
          <div v-show="tab === 'glossary'" class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-3">
              <div class="relative max-w-xs flex-1">
                <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input v-model="glossaryQuery" :placeholder="t('studyPackage.glossary.searchPlaceholder')" class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <RegenerateButton :package-id="pkg._id" section="glossary" @regenerated="(d) => (pkg.glossary = d.glossary)" />
            </div>
            <dl class="rounded-2xl border border-slate-200 dark:border-border-dark divide-y divide-slate-100 dark:divide-border-dark">
              <div v-for="g in filteredGlossary" :key="g.term" class="px-5 py-3.5">
                <dt class="font-display font-bold text-slate-900 dark:text-white">{{ g.term }}</dt>
                <dd class="text-sm text-slate-500 dark:text-slate-400 mt-0.5" v-html="renderLatexText(g.meaning)"></dd>
              </div>
              <p v-if="filteredGlossary.length === 0" class="px-5 py-6 text-sm text-slate-400 text-center">{{ t("studyPackage.glossary.noMatches", { query: glossaryQuery }) }}</p>
            </dl>
          </div>

          <!-- QUIZ -->
          <div v-show="tab === 'quiz'" class="max-w-xl mx-auto">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="quiz" @regenerated="(d) => { pkg.quiz = d.quiz; quizKey++; }" />
            </div>
            <QuizPlayer :key="quizKey" :quiz="pkg.quiz" :package-id="pkg._id" />
          </div>

          <!-- FLASHCARDS -->
          <div v-show="tab === 'flashcards'" class="max-w-xl mx-auto">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="flashcards" @regenerated="(d) => { pkg.flashcards = d.flashcards; flashcardsKey++; }" />
            </div>
            <FlashcardDeck :key="flashcardsKey" :flashcards="pkg.flashcards" :package-id="pkg._id" />
          </div>

          <!-- PRACTICE TASKS -->
          <div v-show="tab === 'practice'" class="flex flex-col gap-3">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="practice_tasks" @regenerated="(d) => (pkg.practice_tasks = d.practice_tasks)" />
            </div>
            <div v-for="(task, i) in pkg.practice_tasks" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <span class="badge mb-2" :class="diffTint(task.difficulty)">{{ task.difficulty }}</span>
              <p class="font-medium text-slate-900 dark:text-white mb-2" v-html="renderLatexText(task.task)"></p>
              <details class="mb-1.5 group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> {{ t("studyPackage.practice.hint") }}
                </summary>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 pl-5" v-html="renderLatexText(task.hint)"></p>
              </details>
              <details class="group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> {{ t("studyPackage.practice.solution") }}
                </summary>
                <p class="text-sm text-slate-600 dark:text-slate-300 mt-1.5 pl-5"><RichContent :text="task.solution" /></p>
              </details>
              <p class="font-mono text-xs text-slate-400 mt-3">{{ t("studyPackage.practice.uses") }} {{ (task.concepts_used || []).join(", ") }}</p>
            </div>
          </div>

          <!-- TRUE/FALSE -->
          <div v-show="tab === 'truefalse'">
            <div class="flex justify-end mb-3">
              <RegenerateButton :package-id="pkg._id" section="true_false_questions" @regenerated="(d) => { pkg.true_false_questions = d.true_false_questions; trueFalseKey++; }" />
            </div>
            <TrueFalseQuiz :key="trueFalseKey" :questions="pkg.true_false_questions" />
          </div>

          <!-- SHORT ANSWER -->
          <div v-show="tab === 'shortanswer'" class="flex flex-col gap-3">
            <div class="flex justify-end">
              <RegenerateButton :package-id="pkg._id" section="short_answer_questions" @regenerated="(d) => (pkg.short_answer_questions = d.short_answer_questions)" />
            </div>
            <div v-for="(q, i) in pkg.short_answer_questions" :key="i" class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <p class="font-medium text-slate-900 dark:text-white mb-2" v-html="renderLatexText(q.question)"></p>
              <textarea v-model="shortAnswerDrafts[i]" rows="2" :placeholder="t('studyPackage.shortAnswer.placeholder')" class="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 mb-2"></textarea>
              <details class="group">
                <summary class="cursor-pointer text-sm font-semibold text-primary list-none flex items-center gap-1">
                  <ChevronRightIcon class="w-4 h-4 group-open:rotate-90 transition-transform" /> {{ t("studyPackage.shortAnswer.reveal") }}
                </summary>
                <div class="mt-1.5 pl-5">
                  <p class="text-sm text-slate-700 dark:text-slate-200" v-html="renderLatexText(q.expected_answer)"></p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-1"><strong>{{ t("studyPackage.shortAnswer.gradingHint") }}</strong> <span v-html="renderLatexText(q.grading_hint)"></span></p>
                </div>
              </details>
            </div>
          </div>

          <!-- LEARNING PATH -->
          <div v-show="tab === 'path'" class="grid sm:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5 sm:col-span-2">
              <h3 class="font-display font-bold mb-3">{{ t("studyPackage.path.objectives") }}</h3>
              <ul class="flex flex-col gap-2">
                <li v-for="o in pkg.learning_objectives" :key="o" class="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircleIcon class="w-5 h-5 text-success shrink-0 mt-0.5" /> {{ o }}
                </li>
              </ul>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">{{ t("studyPackage.path.prerequisites") }}</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="p in pkg.prerequisites" :key="p">{{ p }}</li></ul>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-border-dark p-5">
              <h3 class="font-display font-bold mb-2">{{ t("studyPackage.path.nextSteps") }}</h3>
              <ul class="list-disc list-inside text-sm space-y-1.5 text-slate-600 dark:text-slate-300"><li v-for="n in pkg.recommended_next_steps" :key="n">{{ n }}</li></ul>
            </div>
          </div>

          <!-- CHAT -->
          <div v-show="tab === 'chat'" class="max-w-2xl">
            <ChatPanel :package-id="pkg._id" :suggested-prompts="pkg.chatbot_context?.suggested_student_prompts || []" />
          </div>
      </div>
    </div>

    <Modal
      :open="confirmDelete"
      :title="t('studyPackage.deleteModal.title')"
      :confirm-label="t('common.delete')"
      @close="confirmDelete = false"
      @confirm="remove"
    >
      {{ t("common.cannotBeUndone") }}
    </Modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ArrowLeftIcon, TrashIcon, MagnifyingGlassIcon, ChevronRightIcon, ArrowDownTrayIcon,
  FireIcon, CheckCircleIcon, BookOpenIcon, AcademicCapIcon, DocumentTextIcon,
  QueueListIcon, QuestionMarkCircleIcon, Squares2X2Icon, ClipboardDocumentCheckIcon,
  CheckIcon, PencilSquareIcon, MapIcon, ChatBubbleLeftRightIcon,
  VideoCameraIcon, DocumentIcon, SparklesIcon, ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { api } from "../services/api.js";
import { useToastStore } from "../stores/toast.js";
import { useAuthStore } from "../stores/auth.js";
import { downloadMarkdown, downloadJson, openPrintView } from "../composables/useExport.js";
import { renderLatexText, renderBlockFormula } from "../composables/useLatex.js";
import { useI18n } from "../composables/useI18n.js";
import { useClickOutside } from "../composables/useClickOutside.js";
import QuizPlayer from "../components/QuizPlayer.vue";
import FlashcardDeck from "../components/FlashcardDeck.vue";
import TrueFalseQuiz from "../components/TrueFalseQuiz.vue";
import ChatPanel from "../components/ChatPanel.vue";
import ConceptExplainer from "../components/ConceptExplainer.vue";
import RegenerateButton from "../components/RegenerateButton.vue";
import YouTubePlayer from "../components/YouTubePlayer.vue";
import RichContent from "../components/RichContent.vue";
import Modal from "../components/ui/Modal.vue";

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();
const { t } = useI18n();

const pkg = ref(null);
const loading = ref(true);
const error = ref("");
const tab = ref("summary");
const confirmDelete = ref(false);
const glossaryQuery = ref("");
const shortAnswerDrafts = reactive({});
const exportOpen = ref(false);
const exportMenuRef = ref(null);
useClickOutside(exportMenuRef, () => (exportOpen.value = false));
const quizKey = ref(0);
const flashcardsKey = ref(0);
const trueFalseKey = ref(0);

const tabs = [
  { id: "summary", labelKey: "studyPackage.tabs.summary", icon: BookOpenIcon },
  { id: "concepts", labelKey: "studyPackage.tabs.concepts", icon: AcademicCapIcon },
  { id: "notes", labelKey: "studyPackage.tabs.notes", icon: DocumentTextIcon },
  { id: "glossary", labelKey: "studyPackage.tabs.glossary", icon: QueueListIcon },
  { id: "quiz", labelKey: "studyPackage.tabs.quiz", icon: QuestionMarkCircleIcon },
  { id: "flashcards", labelKey: "studyPackage.tabs.flashcards", icon: Squares2X2Icon },
  { id: "practice", labelKey: "studyPackage.tabs.practice", icon: ClipboardDocumentCheckIcon },
  { id: "truefalse", labelKey: "studyPackage.tabs.truefalse", icon: CheckIcon },
  { id: "shortanswer", labelKey: "studyPackage.tabs.shortanswer", icon: PencilSquareIcon },
  { id: "path", labelKey: "studyPackage.tabs.path", icon: MapIcon },
  { id: "chat", labelKey: "studyPackage.tabs.chat", icon: ChatBubbleLeftRightIcon },
];

const youtubePlayer = ref(null);
const youtubeVideoId = computed(() => {
  const url = pkg.value?.source?.type === "youtube" ? pkg.value.source.url : null;
  if (!url) return null;
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
});

const orderedSourceFilenames = computed(() =>
  [...(pkg.value?.sources || [])].sort((a, b) => a.order - b.order).map((s) => s.filename)
);

// Groups consecutive summary chapters by source_title so multi-file
// packages can show one expandable section per uploaded document. A
// single-source package has no source_title at all, so it collapses to one
// untitled group (rendered flat, no toggle).
const summaryGroups = computed(() => {
  const chapters = pkg.value?.summary || [];
  const groups = [];
  for (const c of chapters) {
    const last = groups[groups.length - 1];
    if (last && last.title === (c.source_title || null)) {
      last.chapters.push(c);
    } else {
      groups.push({ title: c.source_title || null, chapters: [c] });
    }
  }
  return groups;
});
const closedGroups = ref(new Set());
function toggleGroup(title) {
  const next = new Set(closedGroups.value);
  if (next.has(title)) next.delete(title);
  else next.add(title);
  closedGroups.value = next;
}

const notes = computed(() => pkg.value?.study_notes || {});
const filteredGlossary = computed(() => {
  const list = [...(pkg.value?.glossary || [])].sort((a, b) => a.term.localeCompare(b.term));
  const q = glossaryQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((g) => g.term.toLowerCase().includes(q) || g.meaning.toLowerCase().includes(q));
});

const PROGRESS_STEP_KEYS = {
  queued: "studyPackage.progress.queued",
  extracting: "studyPackage.progress.extracting",
  generating: "studyPackage.progress.generating",
  saving: "studyPackage.progress.saving",
};
const progressStepLabel = computed(() => t(PROGRESS_STEP_KEYS[pkg.value?.status] || "studyPackage.progress.working"));

let pollTimer = null;
let pollFailureCount = 0;
const MAX_POLL_FAILURES = 5;
function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = null;
}
async function pollStatus() {
  try {
    const fresh = await api.getPackage(props.id);
    pollFailureCount = 0;
    pkg.value = fresh;
    if (fresh.status === "queued" || fresh.status === "extracting" || fresh.status === "generating" || fresh.status === "saving") {
      pollTimer = setTimeout(pollStatus, 1800);
    }
  } catch (e) {
    // A transient network blip shouldn't permanently strand the user on a
    // hard error screen while the background job may still be running fine.
    pollFailureCount++;
    if (pollFailureCount >= MAX_POLL_FAILURES) {
      error.value = e.message;
    } else {
      pollTimer = setTimeout(pollStatus, 1800);
    }
  }
}

onMounted(async () => {
  try {
    pkg.value = await api.getPackage(props.id);
    if (pkg.value.status && pkg.value.status !== "completed" && pkg.value.status !== "failed") {
      pollTimer = setTimeout(pollStatus, 1800);
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
onUnmounted(stopPolling);

function formatTs(sec) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}
function diffTint(d) {
  if (d === "easy") return "badge-success";
  if (d === "hard") return "badge-danger";
  return "badge-warning";
}

function doExport(format) {
  exportOpen.value = false;
  const watermark = !auth.isPro;
  if (format === "md") downloadMarkdown(pkg.value, { watermark });
  else if (format === "json") downloadJson(pkg.value);
  else openPrintView(pkg.value, { watermark });
}

async function remove() {
  try {
    await api.deletePackage(props.id);
    toast.success(t("toasts.packageDeleted"));
    router.push("/dashboard");
  } catch (e) {
    toast.error(e.message);
  } finally {
    confirmDelete.value = false;
  }
}
</script>

<style scoped>
.badge {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono); font-size: 0.6875rem;
  border: 1px solid rgb(226 232 240); border-radius: 999px;
  padding: 0.2rem 0.65rem; color: rgb(100 116 139);
}
:global(html.dark .badge) { border-color: var(--color-border-dark); color: rgb(148 163 184); }
.badge-primary { background: color-mix(in srgb, var(--color-primary) 10%, transparent); border-color: color-mix(in srgb, var(--color-primary) 30%, transparent); color: var(--color-primary); }
.badge-success { background: color-mix(in srgb, var(--color-success) 10%, transparent); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); color: var(--color-success); }
.badge-warning { background: color-mix(in srgb, var(--color-warning) 12%, transparent); border-color: color-mix(in srgb, var(--color-warning) 35%, transparent); color: #92620a; }
.badge-danger { background: color-mix(in srgb, var(--color-danger) 10%, transparent); border-color: color-mix(in srgb, var(--color-danger) 30%, transparent); color: var(--color-danger); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.12s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
