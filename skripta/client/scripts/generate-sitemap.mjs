// Invoked from prerender.mjs (after the client build). Writes dist/sitemap.xml
// from the same meta.seo.prerender route list prerender.mjs itself uses —
// one source of truth, not a second hand-maintained route list — plus every
// blog post frontmatter slug/date once the blog exists (client/src/content/blog,
// added in 15.3; this script tolerates that directory not existing yet).
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "../dist");
const BLOG_CONTENT_DIR = join(__dirname, "../src/content/blog");
const SITE_URL = (process.env.VITE_SITE_URL || "https://example.com").replace(/\/$/, "");

function blogEntries() {
  if (!existsSync(BLOG_CONTENT_DIR)) return [];
  return readdirSync(BLOG_CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(readFileSync(join(BLOG_CONTENT_DIR, f), "utf-8"));
      return { path: `/blog/${data.slug}`, changefreq: "monthly", priority: 0.6, lastmod: data.date };
    });
}

export function generateSitemap(prerenderRoutes) {
  const staticEntries = prerenderRoutes.map((r) => ({ path: r.path, changefreq: r.meta.seo.changefreq, priority: r.meta.seo.priority }));
  const entries = [...staticEntries, ...blogEntries()];

  const urlset = entries
    .map(
      (e) => `  <url>
    <loc>${SITE_URL}${e.path}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`;
  writeFileSync(join(DIST, "sitemap.xml"), xml);
  console.log(`Wrote sitemap.xml (${entries.length} URLs)`);

  // robots.txt's Sitemap: line needs the real site URL, but the file itself
  // lives as a static public/robots.txt (used verbatim by `vite dev`/`vite
  // preview`) with a placeholder domain — rewrite just that one line in the
  // built dist/ copy so production actually points at the right sitemap.
  const robotsPath = join(DIST, "robots.txt");
  if (existsSync(robotsPath)) {
    const robots = readFileSync(robotsPath, "utf-8").replace(/^Sitemap:.*$/m, `Sitemap: ${SITE_URL}/sitemap.xml`);
    writeFileSync(robotsPath, robots);
  }
}
