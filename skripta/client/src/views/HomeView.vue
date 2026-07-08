<template>
  <section>
    <h1 class="page-title">Your <span class="hl">study packages</span></h1>
    <p class="muted" style="margin-top: -6px">Every lecture you've processed, ready for revision.</p>

    <div v-if="loading" class="muted" style="margin-top: 30px">Loading…</div>
    <div v-else-if="error" class="card" style="margin-top: 30px; border-color: var(--bad)">
      {{ error }} — is the API server running?
    </div>

    <div v-else-if="packages.length === 0" class="card empty">
      <h3>No packages yet</h3>
      <p class="muted">Paste your first lecture transcript and Skripta will build the full study kit.</p>
      <router-link to="/new"><button>Create your first package</button></router-link>
    </div>

    <div v-else class="list">
      <router-link
        v-for="p in packages"
        :key="p._id"
        :to="`/package/${p._id}`"
        class="card item"
      >
        <div class="item-main">
          <h3>{{ p.metadata?.video_title || "Untitled lecture" }}</h3>
          <p class="muted desc">{{ p.metadata?.short_description }}</p>
          <div>
            <span class="badge yellow">{{ p.metadata?.subject || "unknown subject" }}</span>
            <span class="badge">{{ p.metadata?.estimated_level }}</span>
            <span class="badge">{{ p.metadata?.content_type }}</span>
            <span class="badge">{{ p.quizCount }} quiz · {{ p.flashcardCount }} cards</span>
          </div>
        </div>
        <div class="item-side muted mono">{{ formatDate(p.createdAt) }}</div>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { api } from "../api.js";

const packages = ref([]);
const loading = ref(true);
const error = ref("");

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
.page-title { font-size: 34px; font-weight: 800; }
.list { display: flex; flex-direction: column; gap: 12px; margin-top: 26px; }
.item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.06s ease;
}
.item:hover { border-color: var(--ink); transform: translateY(-1px); }
.item h3 { font-size: 18px; margin-bottom: 4px; }
.desc { margin: 0 0 10px; font-size: 14px; }
.item-side { white-space: nowrap; }
.empty { margin-top: 30px; text-align: center; padding: 50px 20px; }
.empty button { margin-top: 12px; }
</style>
