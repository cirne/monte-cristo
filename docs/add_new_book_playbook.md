# Playbook: add a new book

Goal: a new book is selectable from `/`, is readable at `/book/<slug>`, and **Chapter 1** has extracted entities + scenes and has **both entity images and scene images**.

## 1) Discover a source + download

- Find a public-domain source (typically Project Gutenberg). Prefer stable URLs like:
  - `https://www.gutenberg.org/cache/epub/<id>/pg<id>.txt`
  - `https://www.gutenberg.org/files/<id>/<id>-h/<id>-h.htm` (HTML editions)
- Keep the raw source cached under: `data/<slug>/raw/source.(txt|html)` (created by the parser script).

## 2) Write the book-specific parser script

- Add `scripts/books/<slug>/parse.ts` that:
  - Fetches or reuses cached `data/<slug>/raw/source.*`
  - Produces canonical chapter HTML fragments + `book-index.json` via `writeCanonicalBook(...)`
  - Sets `book.title`, `book.author`, `book.source`, `book.license`
- Add tests: `scripts/books/<slug>/parse.test.ts`
- Register the book in `lib/books.ts` (slug + display config).

## 3) Verify the parser works

- Run: `bun run scripts/books/<slug>/parse.ts`
- Confirm outputs exist:
  - `data/<slug>/book-index.json`
  - `data/<slug>/chapters/1.html`

## 4) Index Chapter 1 (entities + scenes)

- Run: `bun run index-chapter --book=<slug> --chapter=1`
- Confirm outputs exist:
  - `data/<slug>/entity-store.json`
  - `data/<slug>/chapter-index.json`

## 5) Verify we extracted entities + scenes

- Inspect `data/<slug>/chapter-index.json` for chapter 1:
  - Non-empty `entities[]`
  - Non-empty `scenes[]` (and `imageDescription` present per scene)

## 6) Generate images for Chapter 1 (entities + scenes) with 32 workers

Prereq: `OPENAI_API_KEY` and `SPACES_*` credentials available in the environment (never commit `.env`).

- Run (both entities + scenes): `bun run generate-images --book=<slug> --chapter=1 --workers=32`
  - Entity images write to: `public/images/entities/<slug>/<entityId>.webp` (local) and upload to Spaces.
  - Scene images write to: `public/images/scenes/<slug>/ch1-scene0.webp` (local) and upload to Spaces.

## 7) Verify in a browser

- Run: `bun run dev`
- In `http://localhost:3000`:
  - Select the new book card → `/book/<slug>` loads
  - Open Chapter 1 → `/book/<slug>/chapter/1` loads
  - Click multiple linked entity names → X-Ray shows description + **entity images**
  - Confirm **scene images** are present/visible where the UI renders scene imagery

## 8) Commit, push, PR

- Before committing: run `bun run lint`, `bun run build`, `bun run test`
- Commit logical chunks separately (e.g. “add book + parser”, then “add generated data/images”).
- Push the branch and open a PR.

