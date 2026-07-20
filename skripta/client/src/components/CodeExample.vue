<template>
  <div class="rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden mb-4 bg-white dark:bg-surface-dark">
    <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 dark:bg-black/40">
      <div class="flex items-center gap-2 min-w-0">
        <CodeBracketIcon class="w-4 h-4 shrink-0 text-primary" />
        <span class="text-sm font-semibold text-white truncate">{{ example.title }}</span>
        <span class="shrink-0 text-[0.65rem] font-mono uppercase tracking-wide text-slate-400 bg-white/10 rounded px-1.5 py-0.5">{{ example.language }}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button v-if="isRunnable" type="button" class="code-ex-btn" @click="toggleEdit">{{ editing ? t("studyPackage.codeExample.done") : t("studyPackage.codeExample.edit") }}</button>
        <button v-if="isRunnable" type="button" class="code-ex-btn code-ex-btn-primary" :disabled="running" @click="runCode">
          <PlayIcon class="w-3.5 h-3.5" />{{ running ? t("studyPackage.codeExample.running") : t("studyPackage.codeExample.run") }}
        </button>
        <button type="button" class="code-ex-btn" @click="copyCode">{{ copied ? t("studyPackage.codeExample.copied") : t("studyPackage.codeExample.copy") }}</button>
      </div>
    </div>

    <textarea
      v-if="editing"
      v-model="editableCode"
      spellcheck="false"
      rows="10"
      class="w-full font-mono text-sm p-4 bg-slate-950 text-slate-100 outline-none resize-y block"
    ></textarea>
    <pre v-else class="!m-0 overflow-x-auto"><code class="hljs text-sm" v-html="highlighted"></code></pre>

    <div v-if="runOutput !== null" class="border-t border-white/10 bg-slate-950 px-4 py-3">
      <p class="text-xs font-semibold text-slate-400 mb-1">{{ t("studyPackage.codeExample.output") }}</p>
      <pre class="text-sm whitespace-pre-wrap font-mono" :class="runError ? 'text-red-400' : 'text-emerald-400'">{{ runOutput }}</pre>
    </div>

    <div v-if="example.time_complexity || example.space_complexity" class="flex flex-wrap gap-2 px-4 pt-3">
      <span v-if="example.time_complexity" class="complexity-badge">⏱ <span v-html="renderLatexText(example.time_complexity)"></span></span>
      <span v-if="example.space_complexity" class="complexity-badge">💾 <span v-html="renderLatexText(example.space_complexity)"></span></span>
    </div>

    <div class="px-4 py-3 flex flex-col gap-2.5">
      <button v-if="example.line_explanations?.length" type="button" class="disclosure-btn" @click="showLines = !showLines">
        <span class="disclosure-caret" :class="{ 'rotate-90': showLines }">▸</span>{{ t("studyPackage.codeExample.explainLines") }}
      </button>
      <div v-if="showLines" class="flex flex-col gap-2 text-sm">
        <div v-for="(le, i) in example.line_explanations" :key="i" class="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
          <code class="text-xs font-mono text-primary break-all">{{ le.line }}</code>
          <p class="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed" v-html="renderLatexText(le.explanation)"></p>
        </div>
      </div>

      <InfoCard v-if="example.common_mistakes?.length" variant="mistake" icon="❌" :title="t('studyPackage.chapter.commonMistakes')">
        <ul class="list-disc list-inside space-y-1">
          <li v-for="x in example.common_mistakes" :key="x" v-html="renderLatexText(x)"></li>
        </ul>
      </InfoCard>

      <button v-if="example.alternative_solution" type="button" class="disclosure-btn" @click="showAlt = !showAlt">
        <span class="disclosure-caret" :class="{ 'rotate-90': showAlt }">▸</span>{{ t("studyPackage.codeExample.alternativeSolution") }}
      </button>
      <p v-if="showAlt" class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed" v-html="renderLatexText(example.alternative_solution)"></p>

      <button v-if="example.expected_output" type="button" class="disclosure-btn" @click="showExpected = !showExpected">
        <span class="disclosure-caret" :class="{ 'rotate-90': showExpected }">▸</span>{{ t("studyPackage.codeExample.expectedOutput") }}
      </button>
      <pre v-if="showExpected" class="text-sm font-mono bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2 whitespace-pre-wrap">{{ example.expected_output }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { CodeBracketIcon, PlayIcon } from "@heroicons/vue/24/solid";
import { useI18n } from "../composables/useI18n.js";
import { useToastStore } from "../stores/toast.js";
import { highlightCode } from "../composables/useMarkdown.js";
import { renderLatexText } from "../composables/useLatex.js";
import InfoCard from "./ui/InfoCard.vue";

const props = defineProps({
  example: { type: Object, required: true },
});

const { t } = useI18n();
const toast = useToastStore();

// Real execution is only offered for JavaScript: it's the one language that
// can run safely, client-side, inside a fully sandboxed iframe with no
// server infrastructure. Every other language gets the AI's stated
// `expected_output` instead of a fake/unsupported Run button.
const RUNNABLE_LANGS = new Set(["javascript", "js"]);
const isRunnable = computed(() => RUNNABLE_LANGS.has((props.example.language || "").toLowerCase()));

function normalizeLang(lang) {
  const l = (lang || "").toLowerCase();
  if (l === "c++") return "cpp";
  if (l === "c#") return "csharp";
  if (l === "js") return "javascript";
  return l;
}

const editing = ref(false);
const editableCode = ref(props.example.code);
const copied = ref(false);
const running = ref(false);
const runOutput = ref(null);
const runError = ref(false);
const showLines = ref(false);
const showAlt = ref(false);
const showExpected = ref(false);

const highlighted = computed(() => highlightCode(normalizeLang(props.example.language), props.example.code).html);

function toggleEdit() {
  editing.value = !editing.value;
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(editing.value ? editableCode.value : props.example.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    toast.error(t("toasts.copyFailed"));
  }
}

// Executes the (possibly student-edited) JS in a sandboxed iframe with
// `sandbox="allow-scripts"` and deliberately NO `allow-same-origin` — this
// gives the code a unique, opaque origin with zero access to this app's
// DOM, cookies, localStorage, or same-origin API. It can only talk back via
// postMessage, which is how console.log output and errors are relayed.
function runCode() {
  if (running.value) return;
  running.value = true;
  runOutput.value = null;
  runError.value = false;

  const code = editing.value ? editableCode.value : props.example.code;
  const logs = [];
  let settled = false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  function cleanup() {
    window.removeEventListener("message", onMessage);
    iframe.remove();
    running.value = false;
  }

  const timeoutId = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    runOutput.value = [...logs, t("studyPackage.codeExample.timeout")].join("\n");
    runError.value = true;
  }, 3000);

  function onMessage(e) {
    if (e.source !== iframe.contentWindow || settled) return;
    if (e.data?.type === "log") {
      logs.push(e.data.text);
    } else if (e.data?.type === "done") {
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      runOutput.value = logs.join("\n") || t("studyPackage.codeExample.noOutput");
      runError.value = false;
    } else if (e.data?.type === "error") {
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      runOutput.value = [...logs, e.data.text].join("\n");
      runError.value = true;
    }
  }
  window.addEventListener("message", onMessage);

  const escaped = JSON.stringify(code);
  iframe.srcdoc = `<!doctype html><html><body><script>
    var send = function(type, text) { parent.postMessage({ type: type, text: text }, "*"); };
    console.log = function() {
      var parts = Array.prototype.slice.call(arguments).map(function(a) {
        return (a && typeof a === "object") ? JSON.stringify(a) : String(a);
      });
      send("log", parts.join(" "));
    };
    try {
      (0, eval)(${escaped});
      send("done", "");
    } catch (err) {
      send("error", "Error: " + (err && err.message ? err.message : String(err)));
    }
  <\/script></body></html>`;
}
</script>
