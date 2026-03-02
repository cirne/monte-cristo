# Agent guide — Monte Cristo Reader

Context for AI agents and humans working on this codebase.

## Critical instructions

- **Before every commit/push:** Run `bun run lint`, `bun run build`, and `bun run test`; fix any errors before pushing.
- **Test coverage:** Ensure any new code has test coverage; add or extend tests as needed.
- **Test suite:** Ensure the entire test suite passes (`bun run test` or `./node_modules/.bin/vitest run`) before committing.
- **Commits:** Do not add one-off scripts (e.g. scripts run once for a data fix). Reusable scripts and code are fine.
- Never commit `.env` or put API keys in code.

## What this project is

X-Ray style reader for **The Count of Monte Cristo**: read chapters, click people/places/events for spoiler-free context. Next.js 16 (App Router), Bun, TypeScript, Tailwind v4.

## Key paths

| Path | Purpose |
|------|---------|
| `app/` | Pages and components |
| `app/chapter/[number]/` | Chapter reader + X-Ray panel |
| `data/` | Generated canonical data (book-index, chapters HTML, chapter index, entity store). Do not hand-edit. |
| `lib/` | Data loading, book/chapter/entity logic, linkify |
| `scripts/` | parse-book, index-chapter (canonical), image generation |

## Data flow

1. `parse-book.ts` → `data/<book>/chapters/*.html`, `data/<book>/book-index.json`
2. `index-chapter --all` → `data/chapter-index.json` + updates `data/entity-store.json`
3. `bun run dev` runs the dev server under nodemon with `--watch data`, so the server restarts when files in `data/` change.

When you change schema or scripts that write to `data/`, run the relevant script and ensure the app still reads the new shape.

## Scripts

- `bun run test` / `npm run test` — Run test suite (Vitest)
- `bun run dev` — Dev server (restarts when `data/` changes, via nodemon)
- `bun run parse-book` — Regenerate canonical chapter HTML + book index
- `bun run index-chapter --all` — Canonical full chapter index rebuild
- `bun run index-chapter --chapter=N` — Incremental chapter patch/reindex (non-destructive by default)
- Parallel index-chapter runs for the same book are safe: writes are guarded by a lock and results are merged.
- `bun run generate-images` — Entity and scene images (needs `OPENAI_API_KEY`). Use `--chapter=N` for all images for a chapter; `--scenes-only` or `--entities-only` to restrict.

## Conventions

- Types from `lib/` (`Chapter`, `StoredEntity`, `EntityType`, etc.). Data loading is server-side only.
- Don’t change `data/*.json` shape without updating `lib/` loaders and scripts that write them.
- Don’t assume `data/*.json` exists in CI; docs/scripts should mention running parse-book / index-chapter.

More: `README.md`, `docs/FUTURE.md`.
