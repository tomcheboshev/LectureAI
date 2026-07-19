import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { createAppRouter } from "./router/index.js";

// Shared by both main.js (browser) and entry-server.js (prerender) so the
// two entry points can never drift on how the app tree is assembled — only
// how it's booted (mount vs renderToString) differs between them.
//
// Deliberately createApp (not createSSRApp) on both sides: the client never
// hydrates the prerendered markup — it mounts fresh and replaces it. Theme
// and locale are client-only (localStorage/matchMedia), so their SSR
// defaults ("light", "en") would mismatch the client's real values on a
// hydration-aware mount; a plain non-hydrating mount sidesteps that
// entirely instead of fighting Vue's hydration-mismatch warnings.
export function createSsrApp() {
  const app = createApp(App);
  const pinia = createPinia();
  const router = createAppRouter();

  app.use(pinia);
  app.use(router);

  return { app, router, pinia };
}
