# The Count of Monte Cristo — Book Reader

An immersive, X-Ray style reader for _The Count of Monte Cristo_ by Alexandre Dumas, père.

Built with **Next.js 16** + **Bun** runtime. Book text sourced from [Project Gutenberg](https://www.gutenberg.org/ebooks/1184) (Public Domain).

## Features

- 📖 **Chapter Reader** — Clean reading interface for all 117 chapters across 5 volumes
- 🗺️ **Character Guide** — X-Ray style character index showing every chapter each character appears in
- 🔍 **Full-Text Search** — Search across all chapters with highlighted excerpts
- 📊 **Reading Progress** — Visual progress bar as you read

## Getting Started

```bash
# Install dependencies
bun install

# (Optional) Re-parse the book data from the raw text
bun run parse-book

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
│   └── book-index.json # Lightweight chapter index (no content)
├── lib/
│   ├── book.ts        # Server-side book data access
│   ├── characters.ts  # Character definitions and metadata
│   └── constants.ts   # Shared constants (volume labels, etc.)
└── scripts/
    └── parse-book.ts  # Book parser (Gutenberg text → JSON)
```

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [Bun](https://bun.sh/) runtime & package manager
- [Tailwind CSS v4](https://tailwindcss.com/)
- TypeScript
