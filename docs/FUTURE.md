# Planned Features

## Chapter indexing (LLM) and scene delineation

**Implemented:**

- **Scene delineation**: Scenes are detected at index time via LLM (`lib/scenes-llm.ts`, used by `scripts/index-chapter.ts`) and stored in each chapter index entry in `data/chapter-index.json`. Each scene has paragraph ranges, optional location/image description, and character IDs. The chapter page uses index scenes only; images are placed at each scene’s `startParagraph`. Fallback when LLM fails: single scene for the whole chapter (`getSingleScene(content)` in `lib/scenes.ts`).
- **Index chapter** (`scripts/index-chapter.ts`): For a chapter (or `--all`):
  1. **Find entities**: LLM extracts people, places, events from the chapter text.
  2. **Generate content**: Spoiler-free intro (on first appearance) and excerpt ("in this chapter") from the text.
  3. **Update if referenced previously**: Entity store (`data/entity-store.json`) keeps canonical entities; names are matched so the same character/place is reused and `firstSeenInChapter` / aliases are updated instead of duplicating.
- **Scenes** are written into each chapter index entry (`scenes: [{ startParagraph, endParagraph }]`) for downstream use (e.g. per-scene context or viewport-based "current scene").

**Usage:** `bun run index-chapter --chapter=1` or `bun run index-chapter --all`. Optional `--seed-from-curated` initializes the entity store from `lib/characters` and `lib/entities` so existing IDs stay stable.

## Scenes (viewport-based current scene)

At any point in the book, the user will be able to click a button and get a sense of the **current scene** based on the text visible at the top of the viewport.

- **Scope**: Not yet designed or implemented.
- **Direction**: Viewport-based (e.g. Intersection Observer or scroll position) to determine which paragraph(s) are "current", then surface a short scene summary or context (e.g. location, characters present) without spoilers.
- **Data / DOM**: When implementing the chapter index and X-Ray links, avoid choices that would make viewport-based scene detection harder later (e.g. keep paragraph boundaries and semantic structure clear).
