// One-time dev tool — generates the static branded fallback OG image used
// by every page that doesn't set a per-page ogImage (client/public/og-default.png).
// Uses the exact same satori/sharp pipeline as the live /api/og endpoint,
// so the static fallback and the dynamic images always look identical.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOgImagePng } from "../src/services/ogImage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "../../client/public/og-default.png");

const png = await generateOgImagePng("LectureAI", "Turn any lecture into a study package");
writeFileSync(OUT_PATH, png);
console.log(`Wrote ${OUT_PATH}`);
