#!/usr/bin/env bun
/**
 * Parser for The War of the Worlds (H. G. Wells).
 * Downloads raw text from Project Gutenberg (#36) or uses cached copy.
 * Outputs canonical chapter HTML files and `book-index.json` under data/war-of-the-worlds/.
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

const TEXT_URL = "https://www.gutenberg.org/cache/epub/36/pg36.txt";
const SLUG = "war-of-the-worlds";

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

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

/** Capitalize the first letter in a word, preserving leading punctuation/quotes. */
function capitalizeWord(word: string): string {
  return word.replace(/^(.*?)(\p{L})(.*)$/u, (_m, prefix: string, letter: string, rest: string) => {
    return `${prefix}${letter.toUpperCase()}${rest}`;
  });
}

/** Title-case a hyphenated segment like "heat-ray" → "Heat-Ray". */
function titleCaseToken(token: string, forceCapitalize: boolean): string {
  if (!forceCapitalize && SMALL_WORDS.has(token.toLowerCase())) {
    return token.toLowerCase();
  }
  return token
    .split("-")
    .map((part) => capitalizeWord(part.toLowerCase()))
    .join("-");
}

/** Title-case a chapter heading like "THE EVE OF THE WAR." / "THE “THUNDER CHILD”." */
function formatChapterTitle(rawTitle: string): string {
  const cleaned = rawTitle.replace(/\.$/, "").trim();
  const words = cleaned.split(/\s+/);
  return words
    .map((word, index) => titleCaseToken(word, index === 0))
    .join(" ");
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
  const bookText = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Actual book divisions are on their own line (TOC uses "BOOK ONE.—…").
  const bookPattern = /^BOOK (ONE|TWO)\s*$/gm;
  const books: Array<{ index: number; label: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = bookPattern.exec(bookText)) !== null) {
    books.push({ index: m.index, label: `BOOK ${m[1]}` });
  }
  if (books.length === 0) {
    throw new Error("No BOOK ONE / BOOK TWO markers found in text.");
  }
  books.push({ index: bookText.length, label: "END" });

  // Chapter headers are a roman numeral alone on a line, then the title line.
  const chapterHeaderPattern = /^([IVX]+)\.\s*\n([^\n]+)\n/gm;

  const chapters: Chapter[] = [];
  const paragraphRemaps: ParagraphIndexRemap[] = [];
  let globalChapterNumber = 1;

  for (let b = 0; b < books.length - 1; b++) {
    const bookStart = books[b].index;
    const bookLabel = books[b].label;
    const bookEnd = books[b + 1].index;
    const bookBody = bookText.slice(bookStart, bookEnd);

    const chaptersInBook: Array<{
      index: number;
      roman: string;
      title: string;
      headerLength: number;
    }> = [];
    chapterHeaderPattern.lastIndex = 0;
    while ((m = chapterHeaderPattern.exec(bookBody)) !== null) {
      chaptersInBook.push({
        index: m.index,
        roman: m[1],
        title: m[2].trim(),
        headerLength: m[0].length,
      });
    }
    chaptersInBook.push({
      index: bookBody.length,
      roman: "",
      title: "END",
      headerLength: 0,
    });

    for (let c = 0; c < chaptersInBook.length - 1; c++) {
      const ch = chaptersInBook[c];
      const next = chaptersInBook[c + 1];
      const chapterNumInBook = romanToInt(ch.roman);
      const sourceContent = bookBody.slice(ch.index + ch.headerLength, next.index).trim();
      const contentPlain = stripPageMarkerLines(sourceContent);

      paragraphRemaps.push(
        buildParagraphIndexRemap(globalChapterNumber, sourceContent, contentPlain)
      );

      const content = textToCanonicalHtml(contentPlain);
      const prettyTitle = formatChapterTitle(ch.title);
      const title = `${bookLabel}, Chapter ${chapterNumInBook}: ${prettyTitle}`;

      chapters.push({
        number: globalChapterNumber,
        title,
        volume: bookLabel,
        content,
      });

      globalChapterNumber++;
    }
  }

  if (chapters.length === 0) {
    throw new Error("No chapters found in The War of the Worlds text.");
  }

  const book: Book = {
    title: "The War of the Worlds",
    author: "H. G. Wells",
    source: "Project Gutenberg (https://www.gutenberg.org/ebooks/36)",
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
