import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// The first persistent-file feature in this codebase — every other file
// upload (packages.js, ogImage.js) either streams straight to the AI
// provider or generates on the fly, never touching disk. Local disk storage means
// avatars are lost on redeploy if hosted on an ephemeral filesystem (e.g. a
// free-tier PaaS without a persistent volume) — fine for local/VPS/
// persistent-volume hosting; swap for object storage (S3/Cloudinary) later
// if the deployment target needs it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "../../../uploads");
export const AVATARS_DIR = path.join(UPLOADS_DIR, "avatars");
const AVATAR_URL_PREFIX = "/uploads/avatars/";

// Resizes/crops to a fixed square and re-encodes as webp regardless of the
// input format — keeps every stored avatar the same predictable size/type
// no matter what the user uploaded.
export async function saveAvatar(buffer) {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  const resized = await sharp(buffer).resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
  await fs.writeFile(path.join(AVATARS_DIR, filename), resized);
  return `${AVATAR_URL_PREFIX}${filename}`;
}

// Only ever deletes a file we ourselves saved (path under our own prefix) —
// never touches an external URL, which is what an OAuth-provided picture
// (e.g. a Google profile photo) looks like.
export async function deleteAvatarIfOwned(pictureUrl) {
  if (!pictureUrl || !pictureUrl.startsWith(AVATAR_URL_PREFIX)) return;
  const filename = pictureUrl.slice(AVATAR_URL_PREFIX.length);
  await fs.unlink(path.join(AVATARS_DIR, filename)).catch(() => {}); // already gone is fine
}
