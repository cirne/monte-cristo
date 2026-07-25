# Monte Cristo Companion — Chrome extension (proof of concept)

Stay on Kindle Cloud Reader and open a **side panel** that progressively indexes **any book** you’re reading from the visible page text (entities, current page summary, story so far). Optional deep-link into this app’s hosted reader when the title matches a public-domain book already in `data/`.

Background and product context: [`docs/any-book-reading-companion.md`](../docs/any-book-reading-companion.md).

## What it does

On `read.amazon.com` (or the local demo page) the extension shows a floating **Read in Companion** pill. Clicking it:

1. Opens a **split-pane** companion column on the right (Kindle is resized so nothing is covered).
2. Extracts the book title and a snippet of the visible reading text (~1.5 KB).
3. `POST`s that chunk to the local app’s `/api/companion/ingest`.
4. Renders entities / this page / story so far in the panel.
5. Re-ingests when the visible text changes (page turns), while the panel stays open.
6. If the title also matches a registered hosted book, shows **Open full reader**.

Copyrighted books are **not** added to `lib/books.ts` or the hosted library. Indexes live under `data/companion/` (gitignored).

## Install (unpacked)

1. Run the reader app: `bun run dev` (default `http://localhost:3000`).
2. In Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `extension/` folder.
3. Set the reader base URL in **Extension options** if the app isn’t on port 3000 (e.g. `http://localhost:3001` when another app owns 3000).
4. Reload the extension after code changes, then reload the Kindle/demo tab.

## Try it without a Kindle account (demo mode)

```bash
# from the repo root, in a second terminal
python3 -m http.server 8080 --directory extension/demo
```

Open `http://localhost:8080/kindle-mock.html` — mock title is **not** in the hosted library. Click **Read in Companion**: the side panel should index the visible page (needs `OPENAI_API_KEY` in `.env` for LLM extraction).

## Real Kindle Cloud Reader

1. Keep `bun run dev` running; confirm options point at that origin.
2. Open `https://read.amazon.com`, open any book, click the pill.
3. **DOM text available:** panel fills and updates as you turn pages.
4. **Canvas-rendered pages:** panel explains that no extractable text is available (OCR is out of scope for this POC).

## Known limitations (POC)

- Newer Kindle Cloud Reader versions often render pages to **canvas**; there is no DOM text to extract. **Without OCR (or another text source), any-book page indexing is not feasible on current Cloud Reader** — see POC findings in [`docs/any-book-reading-companion.md`](../docs/any-book-reading-companion.md).
- In-page split layout cannot force canvas Kindle to reflow; prefer Chrome Side Panel or a separate window if covering the book is unacceptable.
- Kindle’s DOM is unstable; title selectors are best-effort with `document.title` as fallback.
- Desktop Chrome only (stock mobile Chrome has no extensions).
- Not intended for the Chrome Web Store as-is; see the legal notes in `docs/any-book-reading-companion.md`.
