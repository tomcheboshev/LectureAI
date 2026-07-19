// Local, non-AI relevance pre-filter — run on each source's extracted
// images (the {buffer, mimeType, ordinal, label} shape extract.js produces)
// BEFORE they're base64-encoded into an image manifest and sent anywhere.
// extract.js's own floors (MIN_IMAGE_BYTES, a 50x50px minimum, a decompression-
// bomb ceiling) only rule out the most trivial junk; this catches two more
// cheap, purely local signals a real diagram/chart/figure almost never
// exhibits: an extreme aspect ratio (banners, divider rules, thin decorative
// strips) and exact-duplicate bytes (the same logo/footer/watermark image
// embedded on every slide of a deck).
//
// Deliberately NOT a second AI vision call: classifying "diagram vs. meme"
// content-wise needs actual judgment, which is exactly what the single
// combined vision+generation call already does via the IMAGE_RULES prompt
// instructions — adding a dedicated classification call here would cost
// more requests/tokens for the exact intent this rewrite is trying to
// reduce. This stage only removes what's cheaply, unambiguously junk.

import sharp from "sharp";
import { createHash } from "node:crypto";

// A genuine figure/diagram/chart is rarely more than ~6x longer on one axis
// than the other; well beyond that is almost always a banner, rule/divider
// line, or decorative strip rather than content worth a student's attention.
const MAX_ASPECT_RATIO = 6;

export async function filterRelevantImages(images) {
  if (!images?.length) return [];

  const seenHashes = new Set();
  const kept = [];

  for (const img of images) {
    const hash = createHash("sha1").update(img.buffer).digest("hex");
    if (seenHashes.has(hash)) continue; // exact duplicate — e.g. a logo repeated across every slide
    seenHashes.add(hash);

    let width, height;
    try {
      ({ width, height } = await sharp(img.buffer).metadata());
    } catch {
      continue; // unreadable — skip rather than risk sending a broken image to the provider
    }
    if (!width || !height) continue;

    const ratio = Math.max(width / height, height / width);
    if (ratio > MAX_ASPECT_RATIO) continue;

    kept.push(img);
  }

  return kept;
}
