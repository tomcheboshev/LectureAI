<template>
  <header class="topbar" :class="{ scrolled }">
    <div class="container topbar-inner">
      <router-link to="/" class="logo" @click="menuOpen = false">
        <span class="mark">S</span>
        Skripta<span class="dot">.</span>
      </router-link>

      <nav class="nav-desktop">
        <router-link to="/" class="navlink">My packages</router-link>
        <router-link to="/new" class="navlink navlink-cta">+ New package</router-link>
        <button class="icon-btn" type="button" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">
          <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="2"/></svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
      </nav>

      <button class="icon-btn nav-toggle" type="button" aria-label="Toggle menu" @click="menuOpen = !menuOpen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path :d="menuOpen ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div v-if="menuOpen" class="nav-mobile">
      <router-link to="/" class="navlink" @click="menuOpen = false">My packages</router-link>
      <router-link to="/new" class="navlink" @click="menuOpen = false">+ New package</router-link>
      <button class="ghost" type="button" @click="toggleTheme">
        {{ isDark ? "☀ Light mode" : "☾ Dark mode" }}
      </button>
    </div>
  </header>

  <main class="container main">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </main>

  <footer class="container footer muted">
    Paste a transcript → get chapters, notes, a quiz, flashcards and a lecture chatbot.
  </footer>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const menuOpen = ref(false);
const scrolled = ref(false);
const isDark = ref(false);

function applyTheme(dark) {
  isDark.value = dark;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  localStorage.setItem("skripta-theme", dark ? "dark" : "light");
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

function onScroll() {
  scrolled.value = window.scrollY > 4;
}

onMounted(() => {
  const saved = localStorage.getItem("skripta-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved ? saved === "dark" : prefersDark);
  window.addEventListener("scroll", onScroll, { passive: true });
});
onUnmounted(() => window.removeEventListener("scroll", onScroll));
</script>

<style scoped>
.topbar {
  border-bottom: 1.5px solid var(--line);
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
  transition: box-shadow 0.2s ease;
}
.topbar.scrolled { box-shadow: var(--shadow-sm); }
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}
.logo {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 21px;
  text-decoration: none;
  letter-spacing: -0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--hl);
  font-size: 16px;
}
.dot { color: transparent; text-shadow: 0 0 0 var(--hl); -webkit-text-stroke: 1px var(--ink); }
.nav-desktop { display: flex; gap: 16px; align-items: center; }
.navlink {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  padding-bottom: 2px;
}
.navlink.router-link-exact-active { background: linear-gradient(transparent 58%, var(--hl) 58%, var(--hl) 94%, transparent 94%); }
.navlink-cta {
  border: 1.5px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
}
.navlink-cta:hover { background: var(--hl-soft); }
.nav-toggle { display: none; }
.nav-mobile {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 10px 24px 18px;
  border-top: 1px solid var(--line);
}
.nav-mobile .navlink { padding: 10px 0; }

@media (max-width: 680px) {
  .nav-desktop { display: none; }
  .nav-toggle { display: inline-flex; }
  .nav-mobile { display: flex; }
}

.main { padding: 34px 20px 60px; min-height: 70vh; position: relative; }
.footer { padding: 24px 20px 40px; font-size: 13px; border-top: 1px solid var(--line); }
</style>
