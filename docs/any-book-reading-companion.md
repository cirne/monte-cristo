# Any-book reading companion (exploration)

Idea: reuse Monte Cristo Reader’s **intelligence layer** (entities, scenes, spoiler-safe context) for **any book the reader owns**, including non–public-domain novels—without turning this app into a host/republisher of copyrighted text.

Related:

- Planned in-app features: [`docs/FUTURE.md`](./FUTURE.md)
- Adding a **public-domain** book to this hosted reader: [`docs/add_new_book_playbook.md`](./add_new_book_playbook.md)
- Agent / project overview: [`AGENTS.md`](../AGENTS.md), [`README.md`](../README.md)

This doc is exploratory product/architecture notes, not an implementation plan or legal advice.

**Proof of concept:** a desktop Chrome extension implementing the "single click from Kindle Cloud Reader to the companion reader" flow lives in [`extension/`](../extension/README.md), backed by `GET /api/companion/locate` (`lib/companion-locate.ts`).

## Problem

This repo today assumes:

1. You have (or generate) full canonical chapter HTML under `data/<book>/`.
2. The app **hosts and serves** that text in its own reader UI.
3. Sources are public domain (see playbook) or otherwise cleared for the project.

A reader of a purchased, non–public-domain novel wants Monte Cristo–like features (X-Ray entities, current scene, story so far) **while reading elsewhere** (e.g. Kindle), with **no republishing** of the book.

## Product split

| Layer | What it is in this repo | Reuse for any book? |
|-------|-------------------------|---------------------|
| **Intelligence** | `index-chapter`, entity store, scenes, reading-context APIs, spoiler fencing | Yes — largely book-agnostic |
| **Surface** | Next.js chapter reader + `linkify` over hosted HTML | No for copyrighted books — replace with a companion surface |

Target product shape: **personal reading companion**, not a multi-book library of non-PD text.

## Approaches (ranked for personal Kindle use)

### 1. Local “owned ebook → existing pipeline” (highest fidelity)

If the user can legally obtain a DRM-free EPUB (or similar) of a book they purchased:

1. Parse locally into the same canonical chapter HTML shape.
2. Run `index-chapter` locally (or against a private backend).
3. Read in a private instance of this app.

**Pros:** Real in-text X-Ray, search, character guide—same quality as Monte Cristo.  
**Cons:** Not something to productize as “upload any Kindle book”; DRM removal is a separate legal tripwire (see below).

Closest existing path for *public-domain* books: [`docs/add_new_book_playbook.md`](./add_new_book_playbook.md).

### 2. Desktop Chrome extension on Kindle Cloud Reader (best “read where I already am”)

Extension responsibilities:

- Detect book id / title / ASIN.
- Observe visible page / chapter / approximate position.
- Capture text the user is currently reading (progressive chunks), not a silent whole-book dump.
- Feed chunks into a local or private indexer (reuse intelligence concepts from this repo).
- Show a **side panel** (entities, current scene, story so far).

**Prefer overlay / side panel over deep DOM rewrite.** Kindle’s DOM is opaque, virtualized, and change-prone; injected images and in-flow controls often break pagination and get wiped on page turn. Light highlights may be OK later; v1 should not depend on rewriting their reader.

**Mobile Chrome:** stock Chrome on Android/iOS does **not** support extensions like desktop Chrome. Do not plan “mobile Chrome extension that rewrites Kindle DOM.” Options if mobile matters: companion PWA/app, Firefox Android (limited extensions), or a later native/accessibility capture path.

### 3. Native screen-scrape / OCR (weak first bet)

OCR over the Kindle app is brittle, slow, and privacy-heavy. A better native variant later would use **accessibility-tree text capture**, still with a floating companion panel—not pixel scraping.

## Suggested architecture

Thin **Reading Surface Adapter** + shared **Companion Brain**:

```
[Kindle Cloud Reader ext] ─┐
[Local EPUB / this app]   ─┼─► TextChunk { bookId, chapter?, offset, text }
[Accessibility capture]   ─┘              │
                                          ▼
                              Companion Brain (local-first)
                              - entity store / alias merge
                              - progressive scene + entity index
                              - spoiler-safe summaries by max position
                                          │
                                          ▼
                              Overlay UI (panel; not a hosted ebook)
```

Design choices:

- **Local-first index** (e.g. SQLite / IndexedDB); optional sync of metadata only.
- **Progressive indexing** as the user reads (plus small look-ahead), not whole-novel upfront.
- **Position model** adapted to the surface (`bookId + chapterHint + textHash/offset`), not only Gutenberg paragraph indices.
- **Spoiler fence** conditioned on max position seen (same spirit as `/api/context/*`).
- **Avoid persisting a second full copy of the book** on a server if this ever leaves pure personal use; prefer derived notes (entities, short summaries).

Reusable building blocks in this codebase (concepts / code to port, not necessarily call as-is):

- Entity extraction + canonical merge: `scripts/index-chapter.ts`, `lib/canonical-entities.ts`, `lib/entity-store.ts`
- Scenes: `lib/scenes-llm.ts`, chapter index `scenes[]`
- Spoiler-safe context: `lib/reading-context.ts`, `app/api/context/*`
- In-reader linking (hosted surface only): `lib/linkify.ts`

Viewport-based “current scene” for *this* app’s reader is tracked separately in [`docs/FUTURE.md`](./FUTURE.md); a Kindle companion would use an analogous “what’s on screen / last chunk” position instead of Intersection Observer over our DOM.

## Legal considerations (not legal advice)

Assumption under discussion: user **purchased** the book; goal is **personal** enhancement; **no republishing** or sharing of the work.

### Analogy: “like notes on my paper copy”

**Strong for:** private character lists, scene notes, spoiler-safe recaps, a side panel of study aids derived for personal use—intent looks like marginalia, not a substitute edition.

**Weaker for:**

| Activity | Why the analogy frays |
|----------|------------------------|
| Extra full-text digital copies (whole-book HTML cache, second searchable corpus) | Reproduction, not just notes |
| Sending book text to a third-party LLM/API or cloud server | Transmission of a copy to another party; check provider ToS |
| Stripping Kindle DRM to export AZW/etc. | US **DMCA** circumvention issues can apply even if you bought the book |
| Automating against Kindle Cloud Reader | **Amazon ToS** may ban scraping/modification regardless of copyright comfort |
| Shipping a public “index any Kindle book” SaaS that stores full text | Product risk far above personal notes |

### Practical stance for this idea

- Frame as **personal study aids** from a licensed copy, kept private, not a substitute edition.
- Prefer **visible-page / user-initiated** capture over silent whole-book exfiltration.
- Persist **derived metadata** (entities, short summaries); avoid becoming another hosted copy of the novel.
- Avoid **DRM bypass** in any path this project documents or implements.
- Treat **desktop extension + local-first brain** as the ToS/copyright-conscious product shape; treat **public redistribution of text or quote-heavy indexes** as out of scope.

Questions for counsel if this moves beyond personal experimentation: (1) Cloud Reader DOM reading vs DRM strip under DMCA, (2) LLM API transmission of purchased ebook text in your jurisdiction, (3) Amazon ToS exposure for a personal/private extension.

## Rough risk map (personal, no republishing)

| Path | Companion quality | Main risk |
|------|-------------------|-----------|
| Private local EPUB pipeline (no DRM strip) | Highest | Personal reproduction; keep private |
| Desktop extension; visible text; local index | Medium–high | Amazon ToS / DOM fragility |
| Paste chapter into private tool | Medium | Low automation/ToS surface |
| Native OCR scrape | Low | Privacy + brittle + ToS |
| Public any-book SaaS hosting full text | — | Avoid |

## Possible v0 experiments (personal)

1. **Text you can use privately** → run existing indexer → private reader instance (validates intelligence quality).
2. **Minimal desktop Cloud Reader extension** → capture current page text → local entity/scene panel (validates companion UX).
3. Defer mobile in-reader injection and OCR until (1)–(2) prove value.

## Out of scope for this doc

- Implementing an extension or changing the hosted multi-book registry for copyrighted uploads.
- Replacing the public-domain playbook; PD books still follow [`docs/add_new_book_playbook.md`](./add_new_book_playbook.md).
