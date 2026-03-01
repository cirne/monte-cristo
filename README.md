# The Count of Monte Cristo — Book Reader

An immersive, X-Ray style reader for _The Count of Monte Cristo_ by Alexandre Dumas, père.

Built with **Next.js 16** + **Bun** runtime. Book text sourced from [Project Gutenberg](https://www.gutenberg.org/ebooks/1184) (Public Domain).

## Features

- 📖 **Chapter Reader** — Clean reading interface for all 117 chapters across 5 volumes
- 🔗 **X-Ray Links** — Click any person, place, or event in the text to see spoiler-free context
- 🗺️ **Character Guide** — X-Ray style character index showing every chapter each character appears in
- 🔍 **Full-Text Search** — Search across all chapters with highlighted excerpts
- 📊 **Reading Progress** — Visual progress bar as you read

## Getting Started

```bash
# Install dependencies
bun install

# Optional: LLM-powered indexing, character generation, images
# Copy .env.example to .env and set OPENAI_API_KEY (never commit .env)
cp .env.example .env
# Edit .env and add your OpenAI API key

# (Optional) Re-parse the book data from the raw text
bun run parse-book

# (Optional) Rebuild chapter index for X-Ray links (persons, places, events). Run after parse-book.
bun run build-chapter-index

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/               # Next.js App Router pages
│   ├── page.tsx       # Home — book cover + chapter list
│   ├── chapters/      # All chapters listing
│   ├── chapter/[number]/ # Individual chapter reader
│   ├── characters/    # Character X-Ray guide
│   ├── search/        # Full-text search
│   └── api/search/    # Search API route
├── data/
│   ├── book.json      # Parsed book with full chapter text
│   ├── book-index.json # Lightweight chapter index (no content)
│   └── chapter-index.json # Entity index per chapter (X-Ray links; run build-chapter-index)
├── lib/
│   ├── book.ts        # Server-side book data access
│   ├── characters.ts  # Character definitions and metadata
│   ├── chapter-index.ts # Chapter index loader (persons, places, events)
│   ├── constants.ts   # Shared constants (volume labels, etc.)
│   ├── entities.ts   # Places and events (X-Ray)
│   ├── linkify.ts    # Turn paragraph text into clickable entity links
│   ├── env.ts        # Dev-time env (OPENAI_API_KEY from .env)
│   └── openai.ts     # OpenAI client for LLM indexing, characters, images
└── scripts/
    ├── parse-book.ts # Book parser (Gutenberg text → JSON)
    └── build-chapter-index.ts # Build chapter-index.json (run after parse-book)
```

## Planned: Scenes

A **scenes** feature is planned: at any point in the book the user will be able to click a button and get a sense of the **current scene** based on the text visible at the top of the viewport. See [docs/FUTURE.md](docs/FUTURE.md) for notes.

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [Bun](https://bun.sh/) runtime & package manager
- [Tailwind CSS v4](https://tailwindcss.com/)
- TypeScript
- [OpenAI](https://github.com/openai/openai-node) for LLM features (indexing, characters, images) — set `OPENAI_API_KEY` in `.env` at dev time
