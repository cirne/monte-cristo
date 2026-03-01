#!/usr/bin/env bun
/**
 * Parses the Project Gutenberg text of The Count of Monte Cristo
 * into a structured JSON file with chapters and metadata.
 *
 * Source: https://www.gutenberg.org/ebooks/1184
 * (Downloaded from GITenberg mirror on GitHub)
 *
 * Loads .env from project root so OPENAI_API_KEY is available for
 * LLM-powered indexing (e.g. character/entity extraction).
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const TEXT_URL =
  "https://raw.githubusercontent.com/GITenberg/The-Count-of-Monte-Cristo_1184/master/1184-0.txt";

async function fetchBook(): Promise<string> {
  console.log("Fetching book from GitHub mirror...");
  const res = await fetch(TEXT_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface Chapter {
  number: number;
  title: string;
  volume: string;
  content: string;
}

interface Book {
  title: string;
  author: string;
  source: string;
  license: string;
  chapters: Chapter[];
}

function parseBook(raw: string): Book {
  // Normalize Windows line endings
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Find where the actual text starts (second occurrence of "Chapter 1.")
  // The first occurrence is in the Table of Contents
  let chapter1Count = 0;
  let textStartLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^Chapter 1\./.test(lines[i])) {
      chapter1Count++;
      if (chapter1Count === 2) {
        // Back up to find the VOLUME heading
        textStartLine = i;
        for (let j = i - 1; j >= 0; j--) {
          if (/^VOLUME/.test(lines[j])) {
            textStartLine = j;
            break;
          }
        }
        break;
      }
    }
  }

  const textLines = lines.slice(textStartLine);
  const text = textLines.join("\n");

  // Find the end of the book (Project Gutenberg footer)
  const endMarker = "*** END OF THIS PROJECT GUTENBERG EBOOK";
  const endIdx = text.indexOf(endMarker);
  const bookText = endIdx > 0 ? text.slice(0, endIdx).trimEnd() : text;

  // Split into chapters using the pattern "Chapter N. Title"
  const chapterPattern = /\n(Chapter \d+\. [^\n]+)\n/g;
  const chapters: Chapter[] = [];

  const currentVolume = "VOLUME ONE";
  const volumePattern = /^VOLUME (ONE|TWO|THREE|FOUR|FIVE)$/m;

  // Extract all chapter positions
  const matches: Array<{ index: number; header: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = chapterPattern.exec(bookText)) !== null) {
    matches.push({ index: m.index, header: m[1] });
  }

  let vol = currentVolume;
  for (let i = 0; i < matches.length; i++) {
    const { index, header } = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : bookText.length;

    // Get the content between this chapter and the next
    const chapterText = bookText.slice(index, nextIndex);

    // Check if there's a volume heading in the segment before this chapter
    const prevSegment = bookText.slice(i === 0 ? 0 : matches[i - 1].index, index);
    const volMatch = prevSegment.match(volumePattern);
    if (volMatch) {
      vol = `VOLUME ${volMatch[1]}`;
    }

    // Parse "Chapter N. Title"
    const headerMatch = header.match(/^Chapter (\d+)\. (.+)$/);
    if (!headerMatch) continue;

    const number = parseInt(headerMatch[1], 10);
    const title = headerMatch[2].trim();

    // Content is everything after the chapter header line
    const contentStart = chapterText.indexOf("\n", chapterText.indexOf(header)) + 1;
    let content = chapterText
      .slice(contentStart)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Strip PG printed-edition page markers (e.g. 0267m, 20009m) so they don't
    // appear in the UI. Replace with ZWS so paragraph boundaries (and thus
    // scene/entity indices) are unchanged and we don't need to re-run processors.
    const pageMarkerLine = /^\d{4,6}m$/;
    content = content
      .split("\n")
      .map((line) => (pageMarkerLine.test(line.trim()) ? "\u200B" : line))
      .join("\n");

    chapters.push({ number, title, volume: vol, content });
  }

  return {
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas, père",
    source: "Project Gutenberg (https://www.gutenberg.org/ebooks/1184)",
    license: "Public Domain",
    chapters,
  };
}

async function main() {
  let raw: string;
  const meta = import.meta as { dir?: string };
  const baseDir = meta.dir ? join(meta.dir, "..") : process.cwd();
  const dataDir = join(baseDir, "data");
  const localPath = join(dataDir, "raw-book.txt");

  try {
    raw = readFileSync(localPath, "utf-8");
    console.log("Using cached local copy of the book.");
  } catch {
    raw = await fetchBook();
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(localPath, raw);
    console.log("Cached raw book text.");
  }

  console.log("Parsing chapters...");
  const book = parseBook(raw);
  console.log(`Parsed ${book.chapters.length} chapters.`);

  const outPath = join(dataDir, "book.json");
  writeFileSync(outPath, JSON.stringify(book, null, 2));
  console.log(`Wrote ${outPath}`);

  // Also write a lightweight index (no content) for fast loading
  const index = {
    title: book.title,
    author: book.author,
    source: book.source,
    license: book.license,
    chapters: book.chapters.map(({ number, title, volume }) => ({
      number,
      title,
      volume,
    })),
  };
  const indexPath = join(dataDir, "book-index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${indexPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
