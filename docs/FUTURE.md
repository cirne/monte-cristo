# Planned Features

## Chapter indexing (LLM) and scene delineation

**Implemented:**

- **Scene delineation** (`lib/scenes.ts`): Chapters are split into paragraphs (`\n\n+`). Scenes are identified by **paragraph index** (not character offset) so boundaries stay stable under small edits. Regex-based starters: time transitions ("The next day", "Some time later"), location ("In Paris,", "Meanwhile"), etc. Use `getScenes(content)` or `getScenesFromRegex(content)`; optional `getSingleScene(content)` for no subdivision.
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
