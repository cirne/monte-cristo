#!/usr/bin/env bun
/**
 * Parser for Crime and Punishment (Constance Garnett translation).
 * Downloads raw text from Project Gutenberg (#2554) or uses cached copy.
 * Outputs canonical chapter HTML files and `book-index.json` under data/crime-punishment/.
 */

import "../../../lib/loadEnv";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import {
  writeCanonicalBook,
  stripPageMarkerLines,
  buildParagraphIndexRemap,
  remapChapterIndexScenes,
  type Book,
  type Chapter,
  type ParagraphIndexRemap,
  type ChapterIndexLike,
} from "../../../lib/canonical-book";
import { textToCanonicalHtml } from "../../../lib/canonical-html";

const TEXT_URL =
  "https://www.gutenberg.org/cache/epub/2554/pg2554.txt";
const SLUG = "crime-punishment";

async function fetchBook(): Promise<string> {
  console.log("Fetching book from Project Gutenberg mirror...");
  const res = await fetch(TEXT_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface ParsedBookResult {
  book: Book;
  paragraphRemaps: ParagraphIndexRemap[];
}

function romanToInt(roman: string): number {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  let prev = 0;
  for (let i = roman.length - 1; i >= 0; i--) {
    const val = map[roman[i]];
    if (!val) continue;
    if (val < prev) total -= val;
    else {
      total += val;
      prev = val;
    }
  }
  return total;
}

function parseBookWithParagraphRemaps(raw: string): ParsedBookResult {
  const textStartMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const startIdx = raw.indexOf(textStartMarker);
  const endIdx = raw.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Book markers not found in raw text.");
  }
  const body = raw.slice(startIdx + textStartMarker.length, endIdx).trim();

  // Normalise newlines
  const bookText = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Patterns for Part and Chapter headers
  const partPattern = /^PART ([IVX]+)/gm;
  const chapterPattern = /^CHAPTER ([IVX]+)/gm;

  const parts: Array<{ index: number; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = partPattern.exec(bookText)) !== null) {
    parts.push({ index: m.index, label: m[0].trim() });
  }
  // Push sentinel end index
  parts.push({ index: bookText.length, label: "END" });

  const chapters: Chapter[] = [];
  const paragraphRemaps: ParagraphIndexRemap[] = [];
  let globalChapterNumber = 1;

  for (let p = 0; p < parts.length - 1; p++) {
    const partStart = parts[p].index;
    const partLabel = parts[p].label; // e.g. "PART I"
    const partEnd = parts[p + 1].index;
    const partText = bookText.slice(partStart, partEnd);

    // Find chapters within this part
    const chaptersInPart: Array<{ index: number; header: string }> = [];
    chapterPattern.lastIndex = 0; // reset regex state
    while ((m = chapterPattern.exec(partText)) !== null) {
      chaptersInPart.push({ index: m.index, header: m[0].trim() });
    }
    chaptersInPart.push({ index: partText.length, header: "END" });

    for (let c = 0; c < chaptersInPart.length - 1; c++) {
      const chStart = chaptersInPart[c].index;
      const chHeader = chaptersInPart[c].header; // e.g. "CHAPTER I"
      const chEnd = chaptersInPart[c + 1].index;

      const chapterRaw = partText.slice(chStart, chEnd);

      const headerMatch = chHeader.match(/^CHAPTER ([IVX]+)/);
      if (!headerMatch) continue;
      const roman = headerMatch[1];
      const chapterNumInPart = romanToInt(roman);

      const contentStart = chapterRaw.indexOf("\n", chapterRaw.indexOf(chHeader)) + 1;
      const sourceContent = chapterRaw.slice(contentStart).trim();
      const contentPlain = stripPageMarkerLines(sourceContent);

      paragraphRemaps.push(
        buildParagraphIndexRemap(globalChapterNumber, sourceContent, contentPlain)
      );

      const content = textToCanonicalHtml(contentPlain);
      const title = `${partLabel}, Chapter ${chapterNumInPart}`;

      chapters.push({
        number: globalChapterNumber,
        title,
        volume: partLabel,
        content,
      });

      globalChapterNumber++;
    }
  }

  const book: Book = {
    title: "Crime and Punishment",
    author: "Fyodor Dostoyevsky (trans. Constance Garnett)",
    source: "Project Gutenberg (https://www.gutenberg.org/ebooks/2554)",
    license: "Public Domain",
    chapters,
  };

  return { book, paragraphRemaps };
}

function parseBook(raw: string): Book {
  return parseBookWithParagraphRemaps(raw).book;
}

async function main() {
  const baseDir = join(import.meta.dir ?? process.cwd(), "../../..");
  const dataDir = join(baseDir, "data");
  const bookDir = join(dataDir, SLUG);
  const rawDir = join(bookDir, "raw");
  const localPath = join(rawDir, "source.txt");

  let raw: string;
  try {
    raw = readFileSync(localPath, "utf-8");
    console.log("Using cached local copy of the book.");
  } catch {
    raw = await fetchBook();
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(localPath, raw);
    console.log("Cached raw book text.");
  }

  console.log("Parsing chapters...");
  const parsed = parseBookWithParagraphRemaps(raw);
  console.log(`Parsed ${parsed.book.chapters.length} chapters.`);

  writeCanonicalBook(dataDir, SLUG, parsed.book);
  console.log(`Wrote ${bookDir}/chapters/*.html and book-index.json`);

  const chapterIndexPath = join(bookDir, "chapter-index.json");
  if (existsSync(chapterIndexPath)) {
    const chapterIndex = JSON.parse(readFileSync(chapterIndexPath, "utf-8")) as ChapterIndexLike;
    const { updatedIndex, chaptersTouched, scenesTouched } = remapChapterIndexScenes(
      chapterIndex,
      parsed.paragraphRemaps
    );
    if (scenesTouched > 0) {
      writeFileSync(chapterIndexPath, JSON.stringify(updatedIndex, null, 2));
      console.log(
        `Updated chapter-index.json scene ranges (${scenesTouched} scenes across ${chaptersTouched} chapters).`
      );
    } else {
      console.log("No chapter-index scene range updates were needed.");
    }
  }
}

export { parseBookWithParagraphRemaps, parseBook, main };

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
