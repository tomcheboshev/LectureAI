# ADR-0002: Move Avatar Storage to Object Storage

**Status:** Proposed
**Date:** 2026-07-19
**Deciders:** Engineering

## Context

**Scope correction from the initial architecture review:** the earlier pass described this as a general "uploaded file storage" risk. Closer inspection narrows it considerably — `routes/packages.js` and `services/ogImage.js` both use `multer.memoryStorage()` and never write file blobs to disk; only extracted text (`raw_transcript`, `sources[].extracted_text`) is persisted, into MongoDB, both fields marked `select: false`. The **only** feature that touches local disk is user avatar images, in `server/src/services/auth/avatars.js` — resized to 256×256 webp via `sharp` and written to `server/uploads/avatars/`, served statically from `index.js` at `/uploads`. The code's own comment already flags this as "the first persistent-file feature in this codebase."

The problem with local disk here is twofold:

1. **Ephemeral filesystems.** Any hosting target without a persistent volume (many free/low tiers of PaaS platforms) loses every avatar on redeploy.
2. **Multi-instance is broken, not just degraded.** If a second API instance is ever added behind a load balancer, an avatar written by instance A is invisible to instance B — a request that happens to land on B 404s on an avatar that visibly exists. This isn't a future scaling nicety; it's a correctness bug the moment instance count > 1, which is also the scenario ADR-0001 (job queue) unlocks.

## Decision

Move avatar storage to **S3-compatible object storage** (AWS S3, Cloudflare R2, Backblaze B2, or DigitalOcean Spaces — any of these work identically against the S3 API).

## Options Considered

### Option A: Shared persistent volume (EFS/NFS) across instances
| Dimension | Assessment |
|---|---|
| Complexity | Low — `avatars.js` barely changes, still `fs.writeFile` |
| Cost | Medium — managed shared-filesystem products aren't cheap and are platform-specific |
| Scalability | Fixes multi-instance access, but adds a new infra dependency of its own |
| Team familiarity | Low-Medium |

**Pros:** Smallest code change.
**Cons:** Ties deployment to a specific host's shared-filesystem feature; heavier infra than warranted for small, disposable 256×256 images.

### Option B: S3-compatible object storage (recommended)
| Dimension | Assessment |
|---|---|
| Complexity | Low-Medium — one new service module, small `avatars.js` rewrite |
| Cost | Low — avatars are tiny; egress-friendly options like R2 cost cents/month at this scale |
| Scalability | Fully decouples storage from compute; trivially multi-instance |
| Team familiarity | High — S3 API is close to universal |

**Pros:** No vendor lock-in (same client code works against S3, R2, B2, Spaces by swapping `endpoint`); removes the disk dependency entirely rather than relocating it.
**Cons:** New credentials to manage; small added latency per upload (negligible for an infrequent user action).

### Option C: Image CDN/transformation service (Cloudinary, imgix)
| Dimension | Assessment |
|---|---|
| Complexity | Low | 
| Cost | Medium — pay for transformation features not needed here |
| Scalability | Good |
| Team familiarity | Low |

**Pros:** Built-in resizing/transformation pipeline.
**Cons:** `sharp` already does the one transformation this app needs (fixed 256×256 webp) server-side; paying for a heavier service buys capability the app doesn't use.

## Trade-off Analysis

Option A "fixes" the symptom (files not visible across instances) without removing the underlying assumption (compute and storage are coupled). Option B removes the coupling outright, for comparable implementation effort, and every major host speaks the same API so this isn't a bet on one vendor. Given avatars are small and infrequent, the extra network hop on upload is not a meaningful cost.

## Consequences

- Removes the second of the two things (alongside the in-process job queue in ADR-0001) currently pinning this app to single-instance deployment.
- Requires a **one-time migration** of existing local avatars into the bucket, and a corresponding update of `User.picture` URLs in Mongo, so current users don't lose their avatar on cutover.
- The `/uploads` static route and `AVATARS_DIR` local-disk logic can be deleted once migration is verified — this removes code rather than just adding an alternative path.
- One new set of credentials/env vars to manage in every environment.

## Action Items

1. [ ] Provision an S3-compatible bucket (Cloudflare R2 recommended for low egress cost; plain S3 if already AWS-hosted elsewhere).
2. [ ] Add `@aws-sdk/client-s3`; create `server/src/services/storage.js` wrapping `putObject` / `deleteObject` / URL construction.
3. [ ] Update `avatars.js`: keep the existing `sharp` resize step unchanged, swap `fs.mkdir` / `fs.writeFile` for `storage.putObject`, and `fs.unlink` for `storage.deleteObject`.
4. [ ] Add env vars: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (for non-AWS providers), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_PUBLIC_URL_BASE` if serving through a CDN/custom domain. Add all to `.env.example`.
5. [ ] Write and run a one-time migration script: upload existing files under `server/uploads/avatars/` to the bucket, update each affected `User.picture` in Mongo.
6. [ ] Remove the `/uploads` static route in `index.js` and the local `UPLOADS_DIR`/`AVATARS_DIR` logic once migration is verified in production.
7. [ ] Update the README's "Notes" section, which currently states avatars are the only disk-persisted content — reflect the new architecture there.
