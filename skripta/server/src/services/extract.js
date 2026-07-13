import { YoutubeTranscript } from "youtube-transcript";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parseOffice } from "officeparser";
import JSZip from "jszip";
import sharp from "sharp";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { withTimeout } from "../utils/withTimeout.js";

const YOUTUBE_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/;

export function extractYoutubeVideoId(url) {
  const match = String(url || "").match(YOUTUBE_ID_RE);
  return match ? match[1] : null;
}

export async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const { text } = await parser.getText();
    return text;
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function extractPptxText(buffer) {
  const ast = await parseOffice(buffer);
  return ast.toText();
}

// Below a certain size an embedded image is almost always a bullet glyph,
// logo, or decorative background rather than a genuine diagram/chart/photo
// worth showing a student — skip it before it ever reaches Gemini or gets
// persisted.
const MIN_IMAGE_BYTES = 6000;

// Resolves a PPTX relationship Target (e.g. "../media/image1.png", relative
// to ppt/slides/) against the archive-relative directory it's declared in,
// collapsing ".." segments — deliberately not using the WHATWG URL parser
// here, since a scheme like "zip://ppt/slides/" gets "ppt" parsed away as a
// host rather than a path segment, silently truncating the resolved path.
function resolveZipRelativePath(fromDir, target) {
  const parts = fromDir.split("/").filter(Boolean).concat(target.split("/"));
  const resolved = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

// A hostile PPTX/DOCX could embed a "small" image file that's actually a
// decompression bomb (a crafted PNG/JPEG whose decoded pixel buffer is
// orders of magnitude larger than its compressed size) — decoding it would
// spike memory/CPU on the server before the resize step ever gets a chance
// to shrink it. Reject anything implausibly large up front; a legitimate
// slide/document image is never anywhere near this.
const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024;

// Recompresses an extracted image down to a size safe to both send to
// Gemini as inline multimodal input and store as a base64 data URI inside
// the MongoDB document (no object storage is wired up in this app, and a
// deck can embed dozens of full-resolution slide images that would
// otherwise risk the 16MB BSON document cap). Returns null for inputs sharp
// can't decode (corrupt/unsupported embedded image) or that fail the raw
// size guard, rather than throwing — one bad image shouldn't fail the whole
// extraction.
async function compressImageForEmbed(buffer) {
  if (buffer.length > MAX_RAW_IMAGE_BYTES) return null;
  try {
    const out = await sharp(buffer, { limitInputPixels: 100_000_000 })
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { buffer: out, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}

// PPTX files are a zip of XML parts; embedded media lives under
// ppt/media/*. officeparser (used for text) doesn't expose the images
// themselves, so we read the archive directly. Slides are walked in their
// numeric filename order (slide1.xml, slide2.xml, ...), which matches
// on-screen presentation order for the overwhelming majority of exports,
// and each slide's own _rels file gives us exactly the images it embeds (in
// relationship-id order) so results stay stable and de-duplicated.
export async function extractPptxImages(buffer, { maxImages = 24 } = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)[1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)[1]);
      return na - nb;
    });

  const images = [];
  const seenTargets = new Set();

  for (const slidePath of slideFiles) {
    if (images.length >= maxImages) break;
    const slideNum = Number(slidePath.match(/slide(\d+)\.xml$/)[1]);
    const relsPath = `ppt/slides/_rels/${slidePath.split("/").pop()}.rels`;
    const relsFile = zip.files[relsPath];
    if (!relsFile) continue;

    const relsXml = await relsFile.async("string");
    // Attribute order within a <Relationship> tag isn't semantically
    // meaningful in XML — some exporters (LibreOffice/Google Slides, unlike
    // PowerPoint's own consistent Id/Type/Target order) write Target before
    // Type, so each tag's attributes are matched independently rather than
    // requiring a fixed order.
    const relTagRe = /<Relationship\b[^>]*\/?>/g;
    let tagMatch;
    while ((tagMatch = relTagRe.exec(relsXml))) {
      if (images.length >= maxImages) break;
      const tag = tagMatch[0];
      const typeMatch = tag.match(/Type="([^"]*)"/);
      const targetMatch = tag.match(/Target="([^"]+)"/);
      if (!typeMatch || !targetMatch || !/\/image$/.test(typeMatch[1])) continue;
      const target = targetMatch[1];
      const mediaPath = resolveZipRelativePath("ppt/slides", target);
      if (seenTargets.has(mediaPath)) continue;
      seenTargets.add(mediaPath);

      const mediaFile = zip.files[mediaPath];
      if (!mediaFile) continue;
      const raw = await mediaFile.async("nodebuffer");
      if (raw.length < MIN_IMAGE_BYTES) continue;

      const compressed = await compressImageForEmbed(raw);
      if (!compressed) continue;
      images.push({ ...compressed, ordinal: images.length, label: `slide ${slideNum}` });
    }
  }

  return images;
}

// mammoth's raw-text extraction (used for the transcript) never touches
// embedded images, so images are pulled with a second, separate pass using
// its HTML conversion with a custom image handler — the generated HTML
// itself is discarded, only the image bytes collected along the way matter.
export async function extractDocxImages(buffer, { maxImages = 24 } = {}) {
  const images = [];

  await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        if (images.length < maxImages) {
          const raw = Buffer.from(await image.readAsBase64String(), "base64");
          if (raw.length >= MIN_IMAGE_BYTES) {
            const compressed = await compressImageForEmbed(raw);
            if (compressed) images.push({ ...compressed, ordinal: images.length, label: null });
          }
        }
        return { src: "" };
      }),
    }
  );

  return images;
}

// Guards against a PDF declaring an absurdly large embedded image (e.g. a
// crafted 20000x20000 XObject) — pdfjs must fully decode an image to raw
// pixels before we can even inspect its dimensions, so this can't prevent
// that decode's cost, but it stops the decoded buffer from being compounded
// further (re-encoded, base64'd, sent to Gemini) once it's clearly not a
// legitimate slide/document image.
const MAX_IMAGE_PIXELS = 40_000_000; // ~40MP, e.g. a 6350x6350 image

// pdfjs decodes every embedded image to raw pixels internally regardless of
// its original encoding (JPEG, PNG-style Flate, etc.), exposed via
// ImageKind: 1 = 1bpp grayscale (packed bits, rare — skipped), 2 = 24bpp
// RGB, 3 = 32bpp RGBA.
const PDF_IMAGE_CHANNELS = { 2: 3, 3: 4 };

async function compressRawPixelsForEmbed(data, width, height, channels) {
  if (width * height > MAX_IMAGE_PIXELS) return null;
  try {
    const out = await sharp(Buffer.from(data), { raw: { width, height, channels } })
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return { buffer: out, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}

// Walks each page's operator list for paintImageXObject/paintJpegXObject
// ops and resolves the referenced object via page.objs — this pulls the
// already-decoded raw pixel buffer straight out of pdfjs without needing a
// canvas or rendering full pages (unlike a page-screenshot approach, which
// would need @napi-rs/canvas as a rendering target). Scans at most the
// first MAX_PAGES pages: a pathological page count shouldn't turn a single
// upload into an unbounded amount of decode work.
const MAX_PAGES = 60;

export async function extractPdfImages(buffer, { maxImages = 24 } = {}) {
  const images = [];
  const seenObjIds = new Set();
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;

  try {
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (images.length >= maxImages) break;
      const page = await doc.getPage(pageNum);
      const opList = await page.getOperatorList();

      const objIds = [];
      for (let i = 0; i < opList.fnArray.length; i++) {
        if (opList.fnArray[i] === OPS.paintImageXObject || opList.fnArray[i] === OPS.paintJpegXObject) {
          const objId = opList.argsArray[i][0];
          if (typeof objId === "string" && !seenObjIds.has(objId)) {
            seenObjIds.add(objId);
            objIds.push(objId);
          }
        }
      }

      for (const objId of objIds) {
        if (images.length >= maxImages) break;
        // page.objs.get's callback form has no reject path — if pdfjs never
        // invokes it for a given image (a real risk for CMYK/indexed/
        // damaged streams in this headless, no-canvas configuration), the
        // await below would hang forever with nothing to catch. That's not
        // just one image lost: this whole extraction call runs inside a
        // background job holding one of the job queue's only 2 concurrency
        // slots, so an unbounded hang here stalls generation for every user
        // on the server. Timing out and skipping the image is always the
        // safe choice — no single embedded image is worth risking that.
        let imgData;
        try {
          imgData = await withTimeout(
            new Promise((resolve) => page.objs.get(objId, resolve)),
            10000,
            "PDF image object resolution"
          );
        } catch {
          continue;
        }
        const channels = PDF_IMAGE_CHANNELS[imgData?.kind];
        if (!channels || !imgData.width || !imgData.height || !imgData.data) continue;
        // Same "skip decorative glyphs/icons" intent as MIN_IMAGE_BYTES on
        // the PPTX/DOCX paths, expressed in pixels since this is raw
        // decoded data rather than an encoded file size.
        if (imgData.width < 50 || imgData.height < 50) continue;

        const compressed = await compressRawPixelsForEmbed(imgData.data, imgData.width, imgData.height, channels);
        if (!compressed) continue;
        images.push({ ...compressed, ordinal: images.length, label: `page ${pageNum}` });
      }

      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return images;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatSeconds(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${pad2(s)}`;
}

function parseSubtitleTimestamp(ts) {
  const norm = ts.trim().replace(",", ".");
  const parts = norm.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// Shared parser for .srt and .vtt — both use "start --> end" timestamp lines
// followed by one or more lines of cue text, separated by a blank line.
export function extractSubtitleText(buffer) {
  const lines = buffer.toString("utf-8").split(/\r?\n/);
  const timeLineRe = /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})/;

  const cues = [];
  let start = null;
  let textLines = [];

  const flush = () => {
    if (start !== null && textLines.length) {
      cues.push({ start, text: textLines.join(" ").replace(/<[^>]+>/g, "").trim() });
    }
    start = null;
    textLines = [];
  };

  for (const line of lines) {
    const match = line.match(timeLineRe);
    if (match) {
      flush();
      start = parseSubtitleTimestamp(match[1]);
    } else if (line.trim() === "" ) {
      flush();
    } else if (/^\d+$/.test(line.trim()) || line.trim().toUpperCase() === "WEBVTT") {
      // cue index number or the VTT header — not cue text
    } else {
      textLines.push(line.trim());
    }
  }
  flush();

  if (cues.length === 0) {
    const e = new Error("Could not find any subtitle cues in this file.");
    e.status = 400;
    throw e;
  }

  return cues.map((c) => `[${formatSeconds(c.start)}] ${c.text}`).join("\n");
}

export async function fetchYoutubeMetadata(url) {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!res.ok) throw new Error("Could not fetch YouTube video metadata — check the URL is a public video.");
  const data = await res.json();
  return {
    title: data.title,
    channel: data.author_name,
    thumbnail: data.thumbnail_url,
  };
}

function formatTimestamp(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export async function fetchYoutubeTranscript(url) {
  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(url);
  } catch (err) {
    const e = new Error("Could not retrieve captions for this video — it may not have captions available.");
    e.status = 400;
    throw e;
  }
  if (!segments || segments.length === 0) {
    const e = new Error("This video has no available transcript/captions.");
    e.status = 400;
    throw e;
  }

  const text = segments.map((s) => `[${formatTimestamp(s.offset)}] ${s.text}`).join("\n");
  const last = segments[segments.length - 1];
  const durationSeconds = Math.round((last.offset + last.duration) / 1000);
  return { text, durationSeconds };
}
