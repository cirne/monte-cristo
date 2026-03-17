# Migration: Images from repo to DigitalOcean Spaces

Move entity and scene images from `public/images/` (in-repo) to a DigitalOcean Spaces bucket so the repo stays small and images are served via CDN.

---

## CRITICAL: Where the migration runs

**The one-time upload of existing images must NOT run from a developer’s local machine.** Local bandwidth is a bottleneck for ~1 GB and thousands of files.

**Run the upload from a cloud agent only**, for example:

- A **GitHub Actions** workflow (recommended), or
- A **short-lived cloud VM** (e.g. DigitalOcean Droplet, GitHub Codespaces, or similar) that has the repo (with images) checked out and the Spaces credentials in the environment.

The cloud agent should follow the steps in [Phase 1: One-time upload](#phase-1-one-time-upload) and [Cloud agent: run the upload](#cloud-agent-run-the-upload) below.

---

## Prerequisites

- **Spaces bucket:** `monte-cristo` in region SFO3.
- **Endpoint (origin):** `https://monte-cristo.sfo3.digitaloceanspaces.com`
- **CDN URL (for the app):** `https://monte-cristo.sfo3.cdn.digitaloceanspaces.com`
- **Credentials:** In the **cloud** environment where the migration runs, set:
  - `SPACES_ENDPOINT=https://monte-cristo.sfo3.digitaloceanspaces.com`
  - `SPACES_BUCKET=monte-cristo`
  - `SPACES_ACCESS_KEY_ID` (from DigitalOcean Spaces API keys)
  - `SPACES_SECRET_ACCESS_KEY` (secret; do not commit)

Repo already has `.env.example` with `SPACES_ENDPOINT` and `SPACES_ACCESS_KEY_ID`; the secret is configured only in the cloud environment.

---

## Phase 1: One-time upload

Goal: Upload all existing files under `public/images/entities/` and `public/images/scenes/` to the Spaces bucket, preserving path structure, so that:

- `public/images/entities/<bookSlug>/<id>.webp` → bucket key `entities/<bookSlug>/<id>.webp`
- `public/images/scenes/<bookSlug>/ch<N>-scene<M>.webp` → bucket key `scenes/<bookSlug>/ch<N>-scene<M>.webp`

### 1.1 Upload script

Add a script that:

1. Loads env via `../lib/loadEnv` (so it sees `SPACES_*`).
2. Uses the S3-compatible API (`@aws-sdk/client-s3`) with:
   - `endpoint: process.env.SPACES_ENDPOINT`
   - `region: 'us-east-1'` (Spaces ignores it but the SDK requires it)
   - `credentials` from `SPACES_ACCESS_KEY_ID` and `SPACES_SECRET_ACCESS_KEY`
3. Walks `public/images/entities/` and `public/images/scenes/` (per-book subdirs only; skip orphaned files directly under `scenes/` if desired, or upload everything).
4. For each `.webp` file:
   - Key = path relative to `public/images/`, e.g. `entities/monte-cristo/dantes.webp`, `scenes/monte-cristo/ch1-scene0.webp`.
   - `Body` = file contents, `ContentType: 'image/webp'`, `CacheControl: 'public, max-age=31536000, immutable'`.
   - Use `PutObjectCommand` (or multipart for very large files; single PUT is fine for WebP).
5. Is idempotent: safe to re-run (overwrites existing objects).
6. Exits with code 0 on success, non-zero on failure.

Suggested path: `scripts/upload-images-to-spaces.ts`. Usage: `bun run scripts/upload-images-to-spaces.ts`.

### 1.2 Cloud agent: run the upload

The **cloud agent** (GitHub Actions job or cloud VM) must:

1. **Checkout the repo** at a commit where `public/images/entities/` and `public/images/scenes/` still exist (i.e. before they are removed from git).
2. **Install dependencies:** `bun install` (or `npm ci`).
3. **Set environment variables** (from GitHub Actions secrets or cloud env):
   - `SPACES_ENDPOINT=https://monte-cristo.sfo3.digitaloceanspaces.com`
   - `SPACES_BUCKET=monte-cristo`
   - `SPACES_ACCESS_KEY_ID`
   - `SPACES_SECRET_ACCESS_KEY`
4. **Run the upload:** `bun run scripts/upload-images-to-spaces.ts`.
5. **Verify:** e.g. list bucket prefix `entities/` and `scenes/` and confirm object count/size, or open a few CDN URLs in a browser.

Do **not** run this script from a local machine; use the cloud agent only.

---

## Phase 2: App and tooling changes

After Phase 1 is verified:

1. **Image base URL**
   - Add a small helper (e.g. in `lib/images.ts`): `imageBase()` returns `process.env.NEXT_PUBLIC_IMAGE_CDN ?? '/images'`.
   - Set `NEXT_PUBLIC_IMAGE_CDN=https://monte-cristo.sfo3.cdn.digitaloceanspaces.com` in `.env.example` (and in production env). No secrets; this URL is public.
   - Update all places that build image URLs to use `imageBase()`:
     - `app/chapter/[number]/XRayPanel.tsx`: `entitiesBase = ${imageBase()}/entities/${bookSlug}`
     - `app/chapter/[number]/ChapterContent.tsx`: `scenesBase` from `imageBase()`
     - `app/chapter/[number]/ReaderFooter.tsx`: `entitiesBase` from `imageBase()`
     - `app/book/[slug]/characters/CharacterCard.tsx`: `entitiesBaseFor(slug)` using `imageBase()`

2. **Next.js image config**
   - In `next.config.ts`, add `images.remotePatterns` for host `monte-cristo.sfo3.cdn.digitaloceanspaces.com` (and optional custom domain if used).

3. **generate-images script**
   - After generating each WebP buffer, upload to Spaces (same key convention as Phase 1) in addition to or instead of writing to `public/images/`. Prefer uploading and optionally writing locally for backwards compatibility during transition. Eventually generate-images can write only to Spaces.

4. **Docs**
   - Update `docs/image-generation.md` and `docs/add_new_book_playbook.md` to describe Spaces (and CDN URL) and that new images are uploaded to Spaces; local `public/images/` is optional / for offline dev only.

---

## Phase 3: Repo cleanup

After the app is deployed and serving images from the CDN:

1. **Gitignore**
   - Add to `.gitignore`: `public/images/entities/`, `public/images/scenes/` (or `public/images/` if you want to ignore the whole tree).

2. **Remove existing images from the repo**
   - Delete the directories from the working tree and commit, e.g.:
     - `git rm -r public/images/entities public/images/scenes`
   - To remove from history and reclaim space, use `git filter-repo` or BFG Repo Cleaner with paths `public/images/entities/` and `public/images/scenes/`. Coordinate with all contributors before rewriting history.

3. **Optional: keep empty dirs**
   - If you want `bun run dev` to still resolve `/images/...` locally when no env is set, you can keep the directories and rely on gitignore so they’re empty for new clones; the fallback `imageBase() → '/images'` will then show placeholders or 404s unless someone runs a local sync. Alternatively, document that `NEXT_PUBLIC_IMAGE_CDN` should always be set for a full experience.

---

## Summary for the cloud agent

- **Input:** Repo checkout that still contains `public/images/entities/` and `public/images/scenes/`.
- **Env:** `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY` (secret in cloud env only).
- **Command:** `bun run scripts/upload-images-to-spaces.ts`
- **Success:** All existing entity and scene WebP files are in the bucket under `entities/<bookSlug>/` and `scenes/<bookSlug>/`, and CDN URL `https://monte-cristo.sfo3.cdn.digitaloceanspaces.com/<key>` serves them.

After that, proceed with Phase 2 (app changes) and Phase 3 (repo cleanup) as separate work, not necessarily on the same runner.
