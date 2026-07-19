// One-time dev tool — not part of the build pipeline. Rasterizes
// src/assets/logo-mark.svg into every favicon/PWA icon size referenced by
// index.html and manifest.webmanifest. Re-run manually (`node
// scripts/generate-favicons.mjs`) only if the logo mark itself changes;
// output is committed to public/, not regenerated on every build.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_PATH = join(__dirname, "../src/assets/logo-mark.svg");
const PUBLIC_DIR = join(__dirname, "../public");
const svg = readFileSync(SVG_PATH);

mkdirSync(PUBLIC_DIR, { recursive: true });

async function renderPng(size, filename, { padding = 0 } = {}) {
  const outPath = join(PUBLIC_DIR, filename);
  if (padding > 0) {
    // "Maskable" icons need a safe-zone margin so OS icon masks (circle,
    // squircle, etc.) don't clip the logo — shrink the mark and composite
    // it onto a solid, brand-colored square background of the full size.
    const inner = Math.round(size * (1 - padding * 2));
    const mark = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: "#4f46e5" } })
      .composite([{ input: mark, left: Math.round((size - inner) / 2), top: Math.round((size - inner) / 2) }])
      .png()
      .toFile(outPath);
  } else {
    await sharp(svg).resize(size, size).png().toFile(outPath);
  }
  console.log(`Wrote ${filename} (${size}x${size})`);
}

async function main() {
  await renderPng(16, "favicon-16x16.png");
  await renderPng(32, "favicon-32x32.png");
  await renderPng(180, "apple-touch-icon.png");
  await renderPng(192, "android-chrome-192x192.png");
  await renderPng(512, "android-chrome-512x512.png");
  await renderPng(512, "maskable-icon-512x512.png", { padding: 0.1 });

  const icoBuffer = await pngToIco([join(PUBLIC_DIR, "favicon-16x16.png"), join(PUBLIC_DIR, "favicon-32x32.png")]);
  writeFileSync(join(PUBLIC_DIR, "favicon.ico"), icoBuffer);
  console.log("Wrote favicon.ico");
}

main().catch((err) => {
  console.error("Favicon generation failed:", err);
  process.exit(1);
});
