#!/usr/bin/env bun
/**
 * Parser for The Brothers Karamazov (Constance Garnett translation).
 * Downloads raw text from Project Gutenberg (#28054) or uses cached copy.
 * Outputs canonical chapter HTML files and `book-index.json` under data/brothers-karamazov/.
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

const TEXT_URL = "https://www.gutenberg.org/cache/epub/28054/pg28054.txt";
const SLUG = "brothers-karamazov";

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
  const upper = roman.toUpperCase();
  for (let i = upper.length - 1; i >= 0; i--) {
    const val = map[upper[i]];
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
  const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const startIdx = raw.indexOf(startMarker);
  const endIdx = raw.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Book markers not found in raw text.");
  }

  const body = raw.slice(startIdx + startMarker.length, endIdx).trim();
  const bookText = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines = bookText.split("\n");
  const partPattern = /^PART (I|II|III|IV)$/;
  const bookPattern = /^Book\s+([IVXLC]+)\.\s*(.+)$/;
  const epiloguePattern = /^Epilogue$/;
  const footnotesPattern = /^Footnotes$/;
  const chapterPattern = /^Chapter\s+([IVXLC]+)\.?$/;

  // The Gutenberg body contains a full table of contents first; the actual narrative begins at "PART I"
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "PART I") {
      startLine = i;
      break;
    }
  }

  let currentPart = "PART I";
  let currentBookLabel: string | undefined;
  let currentBookTitle: string | undefined;
  let globalChapterNumber = 1;

  const chapters: Chapter[] = [];
  const paragraphRemaps: ParagraphIndexRemap[] = [];

  function nextNonEmptyLineIndex(from: number): number {
    for (let i = from; i < lines.length; i++) {
      if (lines[i]?.trim()) return i;
    }
    return -1;
  }

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]?.trimEnd() ?? "";
    if (!line.trim()) continue;

    const foot = line.match(footnotesPattern);
    if (foot) break;

    const partMatch = line.match(partPattern);
    if (partMatch) {
      currentPart = `PART ${partMatch[1]}`;
      currentBookLabel = undefined;
      currentBookTitle = undefined;
      continue;
    }

    const epiMatch = line.match(epiloguePattern);
    if (epiMatch) {
      currentPart = "EPILOGUE";
      currentBookLabel = "EPILOGUE";
      currentBookTitle = undefined;
      continue;
    }

    const bookMatch = line.match(bookPattern);
    if (bookMatch) {
      currentBookLabel = `BOOK ${bookMatch[1].toUpperCase()}`;
      currentBookTitle = bookMatch[2]?.trim() || undefined;
      continue;
    }

    const chMatch = line.match(chapterPattern);
    if (!chMatch) continue;

    const chapterRoman = chMatch[1].toUpperCase();
    const chapterNumInBook = romanToInt(chapterRoman);
    const titleLineIdx = nextNonEmptyLineIndex(i + 1);
    const chapterTitle = titleLineIdx >= 0 ? (lines[titleLineIdx] ?? "").trim() : "";

    const contentStartIdx = titleLineIdx >= 0 ? titleLineIdx + 1 : i + 1;
    const contentLines: string[] = [];

    for (let j = contentStartIdx; j < lines.length; j++) {
      const peek = (lines[j] ?? "").trimEnd();
      const peekTrim = peek.trim();
      if (peekTrim.match(footnotesPattern)) {
        i = j; // outer loop will increment
        break;
      }
      if (
        peekTrim.match(partPattern) ||
        peekTrim.match(epiloguePattern) ||
        peekTrim.match(bookPattern) ||
        peekTrim.match(chapterPattern)
      ) {
        i = j - 1; // reprocess header in outer loop
        break;
      }
      contentLines.push(peek);
      if (j === lines.length - 1) {
        i = j;
      }
    }

    const sourceContent = contentLines.join("\n").trim();
    const contentPlain = stripPageMarkerLines(sourceContent);
    paragraphRemaps.push(
      buildParagraphIndexRemap(globalChapterNumber, sourceContent, contentPlain)
    );
    const content = textToCanonicalHtml(contentPlain);

    const bookPrefix =
      currentBookLabel && currentBookLabel !== "EPILOGUE"
        ? `${currentBookLabel}${currentBookTitle ? `. ${currentBookTitle}` : ""}`
        : currentBookLabel === "EPILOGUE"
          ? "Epilogue"
          : "Chapter";

    const title = chapterTitle
      ? `${bookPrefix}, Chapter ${chapterNumInBook}. ${chapterTitle}`
      : `${bookPrefix}, Chapter ${chapterNumInBook}`;

    chapters.push({
      number: globalChapterNumber,
      title,
      volume: currentPart,
      content,
    });

    globalChapterNumber++;
  }

  const book: Book = {
    title: "The Brothers Karamazov",
    author: "Fyodor Dostoyevsky (trans. Constance Garnett)",
    source: "Project Gutenberg (https://www.gutenberg.org/ebooks/28054)",
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

