import { YoutubeTranscript } from "youtube-transcript";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

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
