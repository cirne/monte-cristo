# Image generation

This doc describes how entity and scene images are generated, stored, and used in the reader.

## Overview

- **Entity images** (characters, places, events): One image per entity. Prompts are stored in `data/entity-image-prompts.json`. Images appear in the X-Ray popup when you tap an entity link.
- **Scene images**: One image per scene (LLM-delineated scene boundaries from chapter indexing). Scene text is sent to an LLM to produce an image prompt; prompts are stored in `data/scene-image-prompts.json`. Images appear at the start of each scene in the chapter view.
- **Shared style**: All images use the same style guide in `data/image-style.txt`, which is prepended to every DALL·E prompt so the look is consistent (period-accurate 19th-century, fine-art illustration, etc.).
- **Format**: Images are generated via OpenAI DALL·E 3 (PNG), then converted to WebP (quality 82) with sharp for smaller files. Stored in the repo so we avoid regenerating.

## Files and paths

| Purpose | Location |
|--------|----------|
| Shared style | `data/image-style.txt` |
| Entity prompts | `data/entity-image-prompts.json` (keyed by entity id, e.g. `dantes`) |
| Scene prompts | `data/scene-image-prompts.json` (keyed by `ch{N}-scene{M}`) |
| Entity images | `public/images/entities/<book>/{id}.webp` (local) / `entities/<book>/{id}.webp` (Spaces) |
| Scene images | `public/images/scenes/<book>/ch{N}-scene{M}.webp` (local) / `scenes/<book>/ch{N}-scene{M}.webp` (Spaces) |

## DigitalOcean Spaces (CDN)

Images are served via DigitalOcean Spaces CDN to keep the repository size small.

- **CDN URL:** `https://monte-cristo.sfo3.cdn.digitaloceanspaces.com`
- **Bucket:** `monte-cristo` (SFO3 region)
- **Configuration:** The CDN URL is hardcoded in `lib/env.ts`. No environment variables are needed to serve images.
- **Uploads:** The `generate-images.ts` script automatically uploads new images to Spaces if `SPACES_*` credentials are set in `.env`.
- **Manual Migration:** Use `bun run scripts/upload-images-to-spaces.ts` to upload all existing local images to Spaces.

## Shared library: `lib/image-gen.ts`

- **`loadStyle(basePath?)`** — Reads `data/image-style.txt` (default base = cwd).
- **`buildFullPrompt(prompt, style)`** — Returns `style + "\n\nImage prompt: " + prompt` for the API.
- **`generateImageToWebPBuffer(fullPrompt)`** — Calls OpenAI Images API (DALL·E 3, 1024×1024, `b64_json`), decodes PNG, converts to WebP with sharp, returns a `Buffer`.

Used by `scripts/generate-images.ts` (entities and scenes).

## Entity images

**CLI:** `bun run scripts/generate-images.ts`

- **Input:** `data/image-style.txt` and `data/<book>/entity-image-prompts.json`. Entity ids match characters and places/events in the entity store.
- **Behavior:** By default only generates images that don't already exist at `public/images/entities/<book>/{id}.webp`. Use `--force` to regenerate.
- **Options:**
  - `--chapter=N` — Generate all images (entities + scenes) for that chapter. Add `--entities-only` or `--scenes-only` to restrict.
  - `--entity=<id>` — Generate one entity (e.g. `--entity=dantes`).
  - `--all-entities` — Generate all entities that have a prompt and no existing image.
  - `--workers=N` — Parallel requests (default 32; lower if your OpenAI tier limits RPM).
  - `--force` — Overwrite existing images.

**In the app:** The chapter page passes entity data to the X-Ray panel. The panel requests `/images/entities/<book>/{entityId}.webp` for the open entity; if the file is missing, the image fails to load and the portrait area is hidden (no broken image).

## Scene images

**CLI:** `bun run scripts/generate-images.ts` (same script; use `--scene=...`, `--chapter=N`, or `--all-scenes`; add `--scenes-only` when combined with `--chapter=N` to generate only scenes)

- **Input:** `data/<book>/book-index.json` + `data/<book>/chapters/*.html` (from parse-book), `data/image-style.txt`, and optionally existing `data/<book>/scene-image-prompts.json`. Scenes come from the chapter index (`data/<book>/chapter-index.json`); run `bun run index-chapter --chapter=N` or `bun run index-chapter --all` to populate scenes.
- **Prompt generation:** For each scene we slice the chapter paragraphs by `startParagraph`/`endParagraph`, cap at 4000 characters, and call the LLM (gpt-4o-mini) with the style guide and scene text. The model is instructed to produce a single DALL·E prompt: focus on what's visible (setting, lighting, dress, atmosphere), strip or compress dialogue. The returned prompt is saved to `scene-image-prompts.json` (key `ch{N}-scene{M}`).
- **Image generation:** Same as entities: `buildFullPrompt(prompt, style)` → `generateImageToWebPBuffer` → write to `public/images/scenes/<book>/ch{N}-scene{M}.webp`.
- **Behavior:** Skips scenes that already have an image (and optionally skips prompt generation if a prompt already exists). Use `--force` to regenerate images.
- **Options:**
  - `--scene=CHAPTER-SCENE` — e.g. `--scene=1-0` for chapter 1, scene 0.
  - `--chapter=N` — All scenes for that chapter (or all images for the chapter if you omit `--scenes-only`).
  - `--all-scenes` — All chapters, all scenes.
  - `--workers=N` — Parallel image generation (default 32).
  - `--force` — Overwrite existing scene images.

**In the app:** The chapter page uses scenes from the chapter index (`indexEntry.scenes`) and passes them to `ChapterContent`. For each paragraph index that equals a scene's `startParagraph`, we render an image with `src=/images/scenes/<book>/ch{N}-scene{M}.webp` before that paragraph. If the file is missing, the figure is hidden on error.

## Requirements

- **OPENAI_API_KEY** in `.env` (used by both CLIs and by `lib/image-gen`).
- **Bun** (scripts are run with `bun run`).
- **sharp** dependency (PNG → WebP).

## Counts for this book

- **Entities:** 14 characters + 6 places + 1 event = 21 images.
- **Scenes:** The current count depends on the latest `index-chapter --all` run (LLM scene delineation can evolve).
- **Total:** 266 images if all are generated.
