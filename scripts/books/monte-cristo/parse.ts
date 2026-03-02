#!/usr/bin/env bun
/**
 * Parser for The Count of Monte Cristo.
 * Fetches or reads raw text, parses into canonical Book, writes book.json and book-index.json.
 * Uses lib/canonical-book for output and paragraph remap helpers.
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
  "https://raw.githubusercontent.com/GITenberg/The-Count-of-Monte-Cristo_1184/master/1184-0.txt";
const SLUG = "monte-cristo";

async function fetchBook(): Promise<string> {
  console.log("Fetching book from GitHub mirror...");
  const res = await fetch(TEXT_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

interface ParsedBookResult {
  book: Book;
  paragraphRemaps: ParagraphIndexRemap[];
}

function parseBookWithParagraphRemaps(raw: string): ParsedBookResult {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let chapter1Count = 0;
  let textStartLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^Chapter 1\./.test(lines[i])) {
      chapter1Count++;
      if (chapter1Count === 2) {
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

  const endMarker = "*** END OF THIS PROJECT GUTENBERG EBOOK";
  const endIdx = text.indexOf(endMarker);
  const bookText = endIdx > 0 ? text.slice(0, endIdx).trimEnd() : text;

  const chapterPattern = /\n(Chapter \d+\. [^\n]+)\n/g;
  const chapters: Chapter[] = [];
  const paragraphRemaps: ParagraphIndexRemap[] = [];

  let vol = "VOLUME ONE";
  const volumePattern = /^VOLUME (ONE|TWO|THREE|FOUR|FIVE)$/m;

  const matches: Array<{ index: number; header: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = chapterPattern.exec(bookText)) !== null) {
    matches.push({ index: m.index, header: m[1] });
  }

  for (let i = 0; i < matches.length; i++) {
    const { index, header } = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : bookText.length;

    const chapterText = bookText.slice(index, nextIndex);

    const prevSegment = bookText.slice(i === 0 ? 0 : matches[i - 1].index, index);
    const volMatch = prevSegment.match(volumePattern);
    if (volMatch) {
      vol = `VOLUME ${volMatch[1]}`;
    }

    const headerMatch = header.match(/^Chapter (\d+)\. (.+)$/);
    if (!headerMatch) continue;

    const number = parseInt(headerMatch[1], 10);
    const title = headerMatch[2].trim();

    const contentStart = chapterText.indexOf("\n", chapterText.indexOf(header)) + 1;
    const sourceContent = chapterText.slice(contentStart).trim();
    const contentPlain = stripPageMarkerLines(sourceContent);

    paragraphRemaps.push(buildParagraphIndexRemap(number, sourceContent, contentPlain));
    const content = textToCanonicalHtml(contentPlain);
    chapters.push({ number, title, volume: vol, content });
  }

  return {
    book: {
      title: "The Count of Monte Cristo",
      author: "Alexandre Dumas, père",
      source: "Project Gutenberg (https://www.gutenberg.org/ebooks/1184)",
      license: "Public Domain",
      chapters,
    },
    paragraphRemaps,
  };
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
  console.log(`Wrote ${bookDir}/book.json and book-index.json`);

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
