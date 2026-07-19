// Runs after both the client build (dist/) and the SSR build
// (dist-ssr/entry-server.js) have completed. For every route flagged
// meta.seo.prerender in router/index.js, renders it to real static HTML
// with baked-in <title>/meta/OG/canonical/JSON-LD, so crawlers that never
// execute JS (social-card unfurlers, most non-Google bots) see working tags
// — not just Google, whose crawler would eventually run the client JS
// anyway.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { transformHtmlTemplate } from "unhead/server";
import { render, routes } from "../dist-ssr/entry-server.js";
import { generateSitemap } from "./generate-sitemap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "../dist");
const BLOG_CONTENT_DIR = join(__dirname, "../src/content/blog");

const template = readFileSync(join(DIST, "index.html"), "utf-8");

// Preserved BEFORE any route overwrites dist/index.html (the "/" route
// does exactly that, since the root document should genuinely be the
// prerendered landing page). server/src/index.js's catch-all needs a
// neutral, page-agnostic shell for routes with no prerendered file (e.g.
// /dashboard) — serving the landing page's own prerendered index.html for
// those would leave a wrong <title>/content flash until client JS reroutes.
copyFileSync(join(DIST, "index.html"), join(DIST, "app-shell.html"));

function outputPathFor(routePath) {
  // "/" -> dist/index.html (overwrites the template itself, which is
  // correct — the root document should be the prerendered landing page,
  // not the bare CSR shell). Anything else -> dist<path>/index.html, which
  // is what express.static's default `index: true` resolves a clean-URL
  // request to.
  if (routePath === "/") return join(DIST, "index.html");
  return join(DIST, routePath, "index.html");
}

async function prerenderRoute(routePath) {
  const { appHtml, head } = await render(routePath);
  const withApp = template.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`);
  const html = await transformHtmlTemplate(head, withApp);

  const outPath = outputPathFor(routePath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`Prerendered ${routePath} -> ${outPath.replace(DIST, "dist")}`);
}

function blogSlugs() {
  if (!existsSync(BLOG_CONTENT_DIR)) return [];
  return readdirSync(BLOG_CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => matter(readFileSync(join(BLOG_CONTENT_DIR, f), "utf-8")).data.slug);
}

async function main() {
  const prerenderRoutes = routes.filter((r) => r.meta?.seo?.prerender && !r.path.includes(":"));
  if (!prerenderRoutes.length) {
    console.warn("No routes flagged meta.seo.prerender=true — nothing to prerender.");
    return;
  }
  for (const route of prerenderRoutes) {
    await prerenderRoute(route.path);
  }
  console.log(`Prerendered ${prerenderRoutes.length} route(s).`);

  // /blog/:slug is a dynamic route, so it's excluded from the static
  // meta.seo.prerender filter above — enumerate real slugs from the
  // content directory instead and prerender each one individually.
  const slugs = blogSlugs();
  for (const slug of slugs) {
    await prerenderRoute(`/blog/${slug}`);
  }
  console.log(`Prerendered ${slugs.length} blog post(s).`);

  generateSitemap(prerenderRoutes);
}

main().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
