import { Router } from "express";
import { generateOgImagePng } from "../services/ogImage.js";

const router = Router();

const MAX_LEN = 200;

// GET /api/og?title=...&subtitle=... — public, no auth. Used as the
// og:image/twitter:image for pages that don't have a static image (blog
// posts default to this when their frontmatter has no ogImage).
router.get("/", async (req, res) => {
  try {
    const title = String(req.query.title || "LectureAI").slice(0, MAX_LEN);
    const subtitle = req.query.subtitle ? String(req.query.subtitle).slice(0, MAX_LEN) : undefined;

    const png = await generateOgImagePng(title, subtitle);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.send(png);
  } catch (err) {
    console.error("OG image generation failed:", err);
    res.status(500).json({ error: "Could not generate image." });
  }
});

export default router;
