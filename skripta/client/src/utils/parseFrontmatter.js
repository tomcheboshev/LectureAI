// Minimal, browser-safe frontmatter parser for the blog's own simple
// "key: \"value\"" YAML subset — deliberately not gray-matter/js-yaml here:
// those are Node-oriented (risk of a Buffer reference breaking in a browser
// bundle) and this file's whole job is parsed once per post at build time
// anyway via import.meta.glob's eager raw-text import. gray-matter itself
// stays a devDependency used only in the Node build scripts
// (generate-sitemap.mjs), never shipped to the client.
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const [, frontmatter, content] = match;
  const data = {};
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    data[key] = rawValue.trim().replace(/^"(.*)"$/, "$1");
  }
  return { data, content: content.trim() };
}
