# Agent guide — Monte Cristo Reader

This file gives AI agents (and humans) enough context to work effectively on the codebase.

## What this project is

An immersive, X-Ray style reader for **The Count of Monte Cristo** (Dumas). Users read chapters and can click people, places, and events in the text to see spoiler-free context. Built with Next.js 16 (App Router), Bun, TypeScript, and Tailwind v4.

## Tech stack

- **Runtime / package manager**: Bun
- **Framework**: Next.js 16, App Router
- **Styling**: Tailwind CSS v4
- **LLM (optional)**: OpenAI — used for indexing chapters, generating entity intros, and generating images. Requires `OPENAI_API_KEY` in `.env` (never commit `.env`).

## Key paths

| Path | Purpose |
|------|--------|
| `app/` | Next.js App Router pages and components |
| `app/chapter/[number]/` | Chapter reader page + X-Ray panel |
| `data/` | Generated JSON: book, chapter index, entity store. Do not hand-edit; produced by scripts. |
| `lib/` | Server-side data loading, book/chapter/entity logic, linkify, LLM helpers |
| `scripts/` | CLI scripts: parse-book, build-chapter-index, image generation, etc. |
| `public/images/` | Static images (entities, scenes) |

## Data flow

1. **Book text**: `scripts/parse-book.ts` reads the Gutenberg source and writes `data/book.json` and `data/book-index.json`.
2. **Chapter index (X-Ray)**: `scripts/build-chapter-index.ts` (and related index scripts) produces `data/chapter-index.json` — per-chapter entities (persons, places, events) and optional scene metadata. Depends on `data/entity-store.json`.
3. **Entity store**: `data/entity-store.json` is the canonical list of people, places, and events; scripts update it when indexing so entities stay consistent across chapters.
4. **Dev reload**: `lib/data-manifest.ts` is touched by `scripts/watch-data.ts` when `data/` files change so the dev server and in-memory caches pick up new data.

When changing schema or scripts that write to `data/`, run the relevant script (e.g. `bun run parse-book`, `bun run build-chapter-index`) and ensure the app still reads the new shape.

## Scripts (package.json)

- `bun run dev` — Next dev server + `watch-data.ts` (watches `data/` and bumps `DATA_VERSION` in `lib/data-manifest.ts`).
- `bun run parse-book` — Regenerate `data/book.json` and `data/book-index.json` from source.
- `bun run build-chapter-index` — Regenerate `data/chapter-index.json` (run after parse-book when changing indexing).
- `bun run index-chapter` — Index a single chapter (see script for usage).
- `bun run generate-images` / `bun run generate-scene-images` — LLM/image generation for entities and scenes (need `OPENAI_API_KEY`).

## Conventions

- **TypeScript**: Strict; prefer types from `lib/` (e.g. `Chapter`, `ChapterIndexEntry`, `StoredEntity`, `EntityType`).
- **Data loading**: Server-side only for book/chapter/entity data; `lib/book.ts`, `lib/chapter-index.ts`, `lib/entity-store.ts` read from `data/` and are imported from App Router routes or server components.
- **Linkify**: `lib/linkify.ts` turns paragraph text into clickable entity links using chapter-index and entity store; used in the chapter reader.
- **Entities**: Types live in `lib/chapter-index.ts` (`EntityType`, `ChapterIndexEntity`) and `lib/entity-store.ts` (`StoredEntity`). IDs are stable slugs (e.g. `edmond_dantes`).

## Before committing / pushing

Always ensure there are no lint errors and the app builds before pushing:

- Run `bun run lint` and fix any reported issues.
- Run `bun run build` and fix any build errors.

## Things to avoid

- Do not commit `.env` or put API keys in code.
- Do not assume `data/*.json` exists in CI or fresh clones; scripts or docs should mention running `parse-book` / `build-chapter-index` as needed.
- Do not change the shape of `data/*.json` without updating the corresponding `lib/` loaders and any scripts that write them.

## More

- User-facing overview: `README.md`
- Future/planned work: `docs/FUTURE.md` (e.g. scenes feature)
