import { YoutubeTranscript } from "youtube-transcript";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parseOffice } from "officeparser";

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
