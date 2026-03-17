# Execution plan: Images to Spaces migration

This plan runs the migration described in [images-to-spaces-migration.md](./images-to-spaces-migration.md), with a **pilot upload** first, **default CDN URL** so the app works without env, and **repo slim-down** after migration.

**Goals:** Serve images from DigitalOcean Spaces CDN; default to CDN URL when no env is set; reduce repo from >3GB to <50MB by removing image history.

---

## 0. Defaults (app works without env)

So the app can serve images even when no env variables are set for the bucket:

- **CDN URL:** Add `NEXT_PUBLIC_IMAGE_CDN` to `.env.example` with the CDN base URL:  
  `NEXT_PUBLIC_IMAGE_CDN=https://monte-cristo.sfo3.cdn.digitaloceanspaces.com`
- **App helper:** In `lib/images.ts`, define `imageBase()` as:
  - `process.env.NEXT_PUBLIC_IMAGE_CDN` if set, else
  - **default** `https://monte-cristo.sfo3.cdn.digitaloceanspaces.com` (same as `.env.example`).
- So with no `.env`, the app still uses the CDN; with `.env` and no `NEXT_PUBLIC_IMAGE_CDN`, the same default applies.
- **Upload script:** Use `SPACES_ENDPOINT` / `SPACES_BUCKET` / `SPACES_ACCESS_KEY_ID` / `SPACES_SECRET_ACCESS_KEY`. Optionally default `SPACES_ENDPOINT` and `SPACES_BUCKET` from `.env.example` when unset.

**Deliverables:** `.env.example` updated with `NEXT_PUBLIC_IMAGE_CDN`; `lib/images.ts` with default CDN base; all image URL construction goes through `imageBase()` (Phase 2 below can implement this when we switch the app to CDN).

---

## 1. Implement upload script and app CDN wiring (before any upload)

Do this on a branch, before running the pilot or full upload.

1. **Upload script** (as in [images-to-spaces-migration.md](./images-to-spaces-migration.md) § Phase 1.1):
   - Add `scripts/upload-images-to-spaces.ts` that:
     - Loads env via `../lib/loadEnv` (or project root).
     - Uses `@aws-sdk/client-s3` with `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY` (default endpoint/bucket from .env.example values if you want).
     - Accepts an optional `--dry-run` and **`--pilot`** flag (see Step 2).
     - Walks `public/images/entities/` and `public/images/scenes/`, uploads `.webp` with keys like `entities/<bookSlug>/<id>.webp`, `scenes/<bookSlug>/ch<N>-scene<M>.webp`.
     - `ContentType: 'image/webp'`, `CacheControl: 'public, max-age=31536000, immutable'`.
     - Idempotent; exit 0 on success.

2. **App CDN defaults and image base** (Phase 2 of migration doc, with defaults):
   - Add `lib/images.ts`: `imageBase()` returns `process.env.NEXT_PUBLIC_IMAGE_CDN ?? 'https://monte-cristo.sfo3.cdn.digitaloceanspaces.com'`.
   - Update `.env.example`: add `NEXT_PUBLIC_IMAGE_CDN=https://monte-cristo.sfo3.cdn.digitaloceanspaces.com`.
   - Replace hardcoded `/images` in:
     - `app/chapter/[number]/XRayPanel.tsx` → `entitiesBase = ${imageBase()}/entities/${bookSlug}`
     - `app/chapter/[number]/ChapterContent.tsx` → `scenesBase` from `imageBase()`
     - `app/chapter/[number]/ReaderFooter.tsx` → `entitiesBase` from `imageBase()`
     - `app/book/[slug]/characters/CharacterCard.tsx` → use `imageBase()` for entity images
   - In `next.config.ts`, add `images.remotePatterns` for host `monte-cristo.sfo3.cdn.digitaloceanspaces.com`.

3. **Lint, build, test:** Run `bun run lint`, `bun run build`, `bun run test` and fix any issues.

At this point the app is configured to use the CDN by default; no images exist in the bucket yet, so the UI will 404 until we upload.

---

## 2. Pilot upload and early verification

**Purpose:** Verify that (1) basic uploading to the bucket works, and (2) the web client shows images when they are hosted in the bucket. Do this with a small set of images before running the full upload.

1. **Pilot scope:**
   - **Entities:** Chapter-1 entity images for `monte-cristo` (e.g. entities with `firstSeenInChapter === 1`; derive from entity store).
   - **Scenes:** `public/images/scenes/monte-cristo/ch1-scene*.webp`.

2. **Implement `--pilot` in the upload script:**
   - When `--pilot` is passed, upload only those entity and scene files (small set).

3. **Run pilot upload:**
   - Ensure `.env` has `SPACES_*` credentials.
   - Run: `bun run scripts/upload-images-to-spaces.ts --pilot`.
   - **Verify upload:** Confirm objects exist in the bucket under `entities/monte-cristo/` and `scenes/monte-cristo/` (e.g. list bucket or open a CDN URL in a browser).

4. **Verify in the web client:**
   - Run the app (`bun run dev`); app uses default CDN URL.
   - Open chapter 1; open X-Ray for a chapter-1 entity that has an image — confirm the portrait loads from the bucket (CDN).
   - Confirm at least one chapter-1 scene image loads in the reader from the bucket.
   - If anything 404s, fix paths or CORS/Next.js `remotePatterns` and re-check.

5. **Only after both checks pass:** Proceed to full upload (Step 3).

---

## 3. Full upload

- **Input:** Repo with `public/images/entities/` and `public/images/scenes/` still present.
- **Env:** `.env` with `SPACES_*` credentials.
- **Command:** `bun run scripts/upload-images-to-spaces.ts` (no `--pilot`).
- **Verify:** List bucket and spot-check CDN URLs; optionally smoke-test the web UI for a few chapters/entities.

---

## 4. generate-images: upload to Spaces

- Update `scripts/generate-images.ts` so that after generating each WebP (entity or scene), it uploads to Spaces using the same key convention as the upload script (and uses the same env / S3 client).
- Prefer: upload to Spaces and optionally write to `public/images/` for local dev during transition; once migration is done, can stop writing locally (see Step 6).
- Document in `docs/image-generation.md` and `docs/add_new_book_playbook.md` that images live on Spaces and the CDN URL is in `.env.example`.

---

## 5. Clean up local images and gitignore

- Add to `.gitignore`: `public/images/entities/`, `public/images/scenes/` (or `public/images/` if you want to ignore the whole tree).
- Remove tracked image dirs from the working tree and commit:
  - `git rm -r public/images/entities public/images/scenes`
- **Do we still need `public/images/`?** With the app defaulting to the CDN URL, we do **not** need local images for the app to work. Options:
  - **Remove entirely:** Delete `public/images/` (and any remaining contents), commit. New clones get no local images; all images come from CDN.
  - **Keep empty dirs:** Keep `public/images/` with empty `entities/` and `scenes/` (gitignored) so that if someone sets `NEXT_PUBLIC_IMAGE_CDN=` or points to a local path in the future, the structure exists. The migration doc suggested this as optional.
- **Recommendation:** Remove `public/images/` entirely to keep the repo simple; the app never uses local images when the default CDN is used.

---

## 6. Slim repo: remove image history (<50MB target)

Current repo is >3GB, almost all from image binaries. To make `git pull` small (<50MB):

1. **Coordinate:** All contributors must be aware; history rewrite will change commit SHAs. Everyone should push pending work and re-clone or rebase after the rewrite.

2. **Rewrite history** to remove image paths:
   - Use **git filter-repo** (preferred) or BFG Repo Cleaner.
   - Remove paths:
     - `public/images/entities/`
     - `public/images/scenes/`
   - If you removed the whole `public/images/` in Step 5, remove `public/images/` (or the same two subdirs if only those were ever committed).

3. **Example (git filter-repo):**
   ```bash
   git filter-repo --path public/images/entities --path public/images/scenes --invert-paths --force
   ```
   (Adjust paths if you deleted the whole `public/images/` tree.)

4. **Verify:** Clone the rewritten repo in a new directory and check size (`du -sh .git`); confirm it’s under 50MB and that the app still builds and shows images from the CDN.

5. **Force-push** the rewritten history (e.g. `main`); notify the team to re-clone or follow the project’s documented recovery steps.

---

## Order of operations summary

| Step | What |
|------|------|
| 0 | Document defaults: `.env.example` + `lib/images.ts` with default CDN URL. |
| 1 | Implement upload script (+ `--pilot`), app `imageBase()` and CDN wiring, next.config, lint/build/test. |
| 2 | Run **pilot** upload (chapter 1 entities + ch1 scenes); verify upload to bucket and that web client shows images; then proceed. |
| 3 | Run **full** upload; verify bucket and CDN. |
| 4 | Update generate-images to upload to Spaces; update docs. |
| 5 | Gitignore image dirs; `git rm` and optionally remove `public/images/`; commit. |
| 6 | Rewrite history with git filter-repo (or BFG); verify repo size <50MB; force-push and coordinate with team. |

---

## Checklist before history rewrite

- [ ] Pilot upload ran; upload to bucket verified and web client shows chapter 1 images from the bucket.
- [ ] Full upload completed; bucket has all entity and scene objects.
- [ ] App uses `imageBase()` and default CDN URL; no env required for serving.
- [ ] generate-images uploads to Spaces; docs updated.
- [ ] Local image dirs removed from repo and gitignored.
- [ ] All contributors notified; no one has unpushed commits that touch image paths.
- [ ] Backup or tag of pre-rewrite repo (optional but recommended).
