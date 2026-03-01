# Agent guide — Monte Cristo Reader

Context for AI agents and humans working on this codebase.

## Critical instructions

- **Before every commit/push:** Run `bun run lint`, `bun run build`, and `bun run test` (or `npm run test`); fix any errors before pushing.
- Never commit `.env` or put API keys in code.

## What this project is

X-Ray style reader for **The Count of Monte Cristo**: read chapters, click people/places/events for spoiler-free context. Next.js 16 (App Router), Bun, TypeScript, Tailwind v4.

## Key paths

| Path | Purpose |
|------|---------|
| `app/` | Pages and components |
| `app/chapter/[number]/` | Chapter reader + X-Ray panel |
| `data/` | Generated JSON (book, chapter index, entity store). Do not hand-edit. |
| `lib/` | Data loading, book/chapter/entity logic, linkify |
| `scripts/` | parse-book, build-chapter-index, image generation |

## Data flow

1. `parse-book.ts` → `data/book.json`, `data/book-index.json`
2. `build-chapter-index` → `data/chapter-index.json` (uses `data/entity-store.json`)
3. `watch-data.ts` bumps `lib/data-manifest.ts` when `data/` changes so dev server picks up new data.

When you change schema or scripts that write to `data/`, run the relevant script and ensure the app still reads the new shape.

## Scripts

- `bun run test` / `npm run test` — Run test suite (Vitest)
- `bun run dev` — Dev server + watch-data
- `bun run parse-book` — Regenerate book JSON
- `bun run build-chapter-index` — Regenerate chapter index
- `bun run index-chapter` — Index one chapter
- `bun run generate-images` / `generate-scene-images` — Entity/scene images (needs `OPENAI_API_KEY`)

## Conventions

- Types from `lib/` (`Chapter`, `StoredEntity`, `EntityType`, etc.). Data loading is server-side only.
- Don’t change `data/*.json` shape without updating `lib/` loaders and scripts that write them.
- Don’t assume `data/*.json` exists in CI; docs/scripts should mention running parse-book / build-chapter-index.

More: `README.md`, `docs/FUTURE.md`.
