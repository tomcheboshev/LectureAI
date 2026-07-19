import { renderToString } from "vue/server-renderer";
import { createHead } from "@unhead/vue/server";
import { createSsrApp } from "./app.js";
import { routes } from "./router/index.js";

// Re-exported so scripts/prerender.mjs can enumerate meta.seo.prerender
// routes straight from this one SSR-built bundle, without a second import
// path into a file that itself depends on import.meta.env.SSR.
export { routes };

// Called once per public route by scripts/prerender.mjs. Returns the
// rendered app markup plus the unhead instance (not pre-serialized tags) —
// the caller uses unhead's own transformHtmlTemplate to merge title/meta/
// link/script tags into the dist/index.html template, rather than this
// module hand-splicing HTML strings itself.
export async function render(url) {
  const { app, router } = createSsrApp();
  const head = createHead();
  app.use(head);

  router.push(url);
  await router.isReady();

  const appHtml = await renderToString(app);
  return { appHtml, head };
}
