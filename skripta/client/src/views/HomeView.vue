<template>
  <section>
    <div class="hero">
      <div>
        <h1 class="page-title">Your <span class="hl">study packages</span></h1>
        <p class="muted lead">Every lecture you've processed — chapters, notes, quizzes, flashcards and a chatbot, ready for revision.</p>
      </div>
      <router-link to="/new"><button class="cta">+ New package</button></router-link>
    </div>

    <div v-if="!loading && !error && packages.length > 0" class="toolbar">
      <div class="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input v-model="query" placeholder="Search by title or subject…" />
      </div>
      <span class="muted mono count">{{ filtered.length }} package{{ filtered.length === 1 ? "" : "s" }}</span>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 4" :key="i" class="card item skeleton-item">
        <div class="skeleton" style="height: 18px; width: 60%; margin-bottom: 10px"></div>
        <div class="skeleton" style="height: 13px; width: 90%; margin-bottom: 6px"></div>
        <div class="skeleton" style="height: 13px; width: 40%"></div>
      </div>
    </div>

    <div v-else-if="error" class="card error-card">
      <strong>Couldn't load your packages.</strong>
      <p class="muted" style="margin: 6px 0 0">{{ error }} — is the API server running?</p>
    </div>

    <div v-else-if="packages.length === 0" class="card empty">
      <div class="empty-mark">S</div>
      <h3>No packages yet</h3>
      <p class="muted">Paste your first lecture transcript and Skripta will build the full study kit — summary, quiz, flashcards and a chatbot.</p>
      <router-link to="/new"><button>Create your first package</button></router-link>
    </div>

    <div v-else-if="filtered.length === 0" class="card empty">
      <h3>No matches</h3>
      <p class="muted">Nothing matches “{{ query }}”. Try a different search.</p>
    </div>

    <div v-else class="grid">
      <router-link
        v-for="p in filtered"
        :key="p._id"
        :to="`/package/${p._id}`"
        class="card item"
      >
        <div class="item-top">
          <span class="badge yellow">{{ p.metadata?.subject || "unknown subject" }}</span>
          <span class="item-date muted mono">{{ formatDate(p.createdAt) }}</span>
        </div>
        <h3>{{ p.metadata?.video_title || "Untitled lecture" }}</h3>
        <p class="muted desc">{{ p.metadata?.short_description }}</p>
        <div class="item-bottom">
          <span class="badge">{{ p.metadata?.estimated_level }}</span>
          <span class="badge">{{ p.metadata?.content_type }}</span>
          <span class="badge">{{ p.quizCount }} quiz · {{ p.flashcardCount }} cards</span>
        </div>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { api } from "../api.js";

const packages = ref([]);
const loading = ref(true);
const error = ref("");
const query = ref("");

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return packages.value;
  return packages.value.filter((p) =>
    [p.metadata?.video_title, p.metadata?.subject].some((f) => f?.toLowerCase().includes(q))
  );
});

onMounted(async () => {
  try {
    packages.value = await api.listPackages();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

function formatDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
</script>

<style scoped>
.hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.page-title { font-size: clamp(28px, 4vw, 38px); font-weight: 800; }
.lead { margin-top: -6px; max-width: 46ch; }
.cta { flex-shrink: 0; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 28px 0 18px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1.5px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  background: var(--card);
  flex: 1;
  max-width: 360px;
  color: var(--muted);
}
.search input { border: none; padding: 9px 0; background: transparent; }
.search input:focus { outline: none; }
.count { white-space: nowrap; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.item {
  display: flex;
  flex-direction: column;
  text-decoration: none;
}
.item:hover { border-color: var(--ink); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.item-date { white-space: nowrap; font-size: 12px; padding-top: 3px; }
.item h3 { font-size: 18px; margin-bottom: 4px; }
.desc {
  margin: 0 0 12px;
  font-size: 14px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-bottom { margin-top: auto; }
.skeleton-item { cursor: default; }

.empty { margin-top: 12px; text-align: center; padding: 56px 20px; }
.empty-mark {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--hl);
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty button { margin-top: 12px; }
.error-card { border-color: var(--bad); background: var(--bad-bg); margin-top: 12px; }
</style>
