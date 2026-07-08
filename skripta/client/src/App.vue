<template>
  <header class="topbar">
    <div class="container topbar-inner">
      <router-link to="/" class="logo">
        Skripta<span class="dot">.</span>
      </router-link>
      <nav>
        <router-link to="/" class="navlink">My packages</router-link>
        <router-link to="/new" class="navlink navlink-cta">+ New package</router-link>
      </nav>
    </div>
  </header>
  <main class="container main">
    <router-view />
  </main>
  <footer class="container footer muted">
    Paste a transcript → get chapters, notes, a quiz, flashcards and a lecture chatbot.
  </footer>
</template>

<style scoped>
.topbar {
  border-bottom: 1.5px solid var(--line);
  background: var(--paper);
  position: sticky;
  top: 0;
  z-index: 10;
}
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}
.logo {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 22px;
  text-decoration: none;
  letter-spacing: -0.03em;
}
.dot { color: transparent; text-shadow: 0 0 0 var(--hl); -webkit-text-stroke: 1px var(--ink); }
nav { display: flex; gap: 18px; align-items: center; }
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
  border-radius: 8px;
  padding: 7px 14px;
}
.navlink-cta:hover { background: var(--hl-soft); }
.main { padding: 34px 20px 60px; min-height: 70vh; }
.footer { padding: 24px 20px 40px; font-size: 13px; border-top: 1px solid var(--line); }
</style>
