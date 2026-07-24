# Monte Cristo Companion — Chrome extension (proof of concept)

One click from Kindle Cloud Reader to the Monte Cristo–style X-Ray reader for the **same book**, synced to your reading position when possible.

Background and product context: [`docs/any-book-reading-companion.md`](../docs/any-book-reading-companion.md).

## What it does

On `read.amazon.com` (or the local demo page) the extension shows a floating **Read in Companion** pill. Clicking it:

1. Extracts the book title (and, best-effort, a snippet of the visible reading text).
2. Calls the reader app's `GET /api/companion/locate?title=…&text=…`.
3. Opens the companion reader:
   - exact **chapter + paragraph** (`/book/<slug>/chapter/<n>?paragraph=<p>`) when the visible text was matched, with a scroll + highlight on arrival;
   - the book landing page (`/book/<slug>`) when only the title matched;
   - a toast if the book isn't in the companion library or the reader isn't running.

Only books registered in `lib/books.ts` (with generated data in `data/`) can be matched. The extension never uploads whole books — it sends the title plus at most ~1.5 KB of currently visible text, only when you click.

## Install (unpacked)

1. Run the reader app: `bun run dev` (default `http://localhost:3000`).
2. In Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `extension/` folder.
3. Optional: set a different reader base URL in the extension options.

## Try it without a Kindle account (demo mode)

The manifest also matches `http://localhost:8080/*` so the mock page works:

```bash
# from the repo root, in a second terminal
python3 -m http.server 8080 --directory extension/demo
```

Open `http://localhost:8080/kindle-mock.html` — it mimics Kindle Cloud Reader showing a page from *The Count of Monte Cristo* (Chapter 20). Click **Read in Companion**: a new tab opens the reader at Chapter 20, scrolled to the exact paragraph.

## Known limitations (POC)

- Newer Kindle Cloud Reader versions render pages to **canvas**; there is no DOM text to extract, so position sync falls back to a title-only book link. DOM-rendering versions and the mock page sync exactly.
- Kindle's DOM is unstable; title selectors are best-effort with `document.title` as fallback.
- Desktop Chrome only (stock mobile Chrome has no extensions).
- Not intended for the Chrome Web Store as-is; see the legal notes in `docs/any-book-reading-companion.md`.
