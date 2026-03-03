#!/usr/bin/env bun
/**
 * Parser for The Great Gatsby.
 * Fetches Gutenberg HTML, splits by <div id="chapter-N">, sanitizes to canonical HTML
 * (preserving <p>, <strong>, <em>, etc.), writes chapters/*.html and book-index.json.
 */

import "../../../lib/loadEnv";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  writeCanonicalBook,
  remapChapterIndexScenes,
  splitParagraphs,
  type Book,
  type Chapter,
  type ParagraphIndexRemap,
  type ChapterIndexLike,
} from "../../../lib/canonical-book";
import { sanitizeToCanonicalHtml } from "../../../lib/canonical-html";

const HTML_URL = "https://www.gutenberg.org/files/64317/64317-h/64317-h.htm";
const SLUG = "gatsby";

/** Strip script/style and decode common entities in HTML before sanitizing. */
function preprocessHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ");
}

/** Remove the first <p>...</p> paragraph from canonical HTML. */
function stripFirstParagraph(html: string): string {
  const firstPRegex = /^<p(?:\s[^>]*)?>[\s\S]*?<\/p>/i;
  const match = html.match(firstPRegex);
  if (match) {
    return html.slice(match[0].length).trim();
  }
  return html.trim();
}

/** Extract chapter HTML and sanitize to canonical format (<p>, <strong>, <em>, etc.). */
function splitChaptersFromHtml(html: string): Array<{ number: number; title: string; content: string }> {
  const chapterDivRegex = /<div\s+id="chapter-(\d+)">/g;
  const matches: { contentStart: number; divStart: number; num: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = chapterDivRegex.exec(html)) !== null) {
    matches.push({
      divStart: m.index,
      contentStart: m.index + m[0].length,
      num: parseInt(m[1], 10),
    });
  }

  if (matches.length === 0) {
    return [];
  }

  const chapters: Array<{ number: number; title: string; content: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const contentEnd = i + 1 < matches.length ? matches[i + 1].divStart : html.length;
    const rawContent = html.slice(matches[i].contentStart, contentEnd);
    const content = sanitizeToCanonicalHtml(preprocessHtml(rawContent)).trim();
    chapters.push({
      number: matches[i].num,
      title: `Chapter ${matches[i].num}`,
      content,
    });
  }
  return chapters;
}

function parseBookWithParagraphRemaps(html: string): {
  book: Book;
  paragraphRemaps: ParagraphIndexRemap[];
} {
  const chapterDivRegex = /<div\s+id="chapter-(\d+)">/g;
  const matches: { contentStart: number; divStart: number; num: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = chapterDivRegex.exec(html)) !== null) {
    matches.push({
      divStart: m.index,
      contentStart: m.index + m[0].length,
      num: parseInt(m[1], 10),
    });
  }

  if (matches.length === 0) {
    throw new Error("No chapters found (expected <div id=\"chapter-N\">)");
  }

  const volume = "Full";
  const chapters: Chapter[] = [];
  const paragraphRemaps: ParagraphIndexRemap[] = [];

  for (let i = 0; i < matches.length; i++) {
    const contentEnd = i + 1 < matches.length ? matches[i + 1].divStart : html.length;
    const rawContent = html.slice(matches[i].contentStart, contentEnd);
    const sourceContent = sanitizeToCanonicalHtml(preprocessHtml(rawContent)).trim();
    const strippedContent = stripFirstParagraph(sourceContent);

    const number = matches[i].num;
    paragraphRemaps.push({
      chapterNumber: number,
      sourceParagraphCount: splitParagraphs(sourceContent).length,
      targetParagraphCount: splitParagraphs(strippedContent).length,
      removedParagraphIndices: [0],
    });

    chapters.push({
      number,
      title: `Chapter ${number}`,
      volume,
      content: strippedContent,
    });
  }

  // Strip Gutenberg end marker from last chapter if present (may appear in text or HTML)
  const lastCh = chapters[chapters.length - 1];
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const idx = lastCh.content.indexOf(endMarker);
  if (idx > 0) {
    lastCh.content = lastCh.content.slice(0, idx).trimEnd();
    // If we cut inside a tag, remove the broken tail
    const lastP = lastCh.content.lastIndexOf("</p>");
    if (lastP >= 0 && lastCh.content.slice(lastP).includes("<")) {
      lastCh.content = lastCh.content.slice(0, lastP + 4);
    }
  }

  return {
    book: {
      title: "The Great Gatsby",
      author: "F. Scott Fitzgerald",
      source: "Project Gutenberg (https://www.gutenberg.org/ebooks/64317)",
      license: "Public Domain",
      chapters,
    },
    paragraphRemaps,
  };
}

async function fetchBook(): Promise<string> {
  console.log("Fetching The Great Gatsby from Project Gutenberg...");
  const res = await fetch(HTML_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseBook(html: string): Book {
  return parseBookWithParagraphRemaps(html).book;
}

async function main() {
  const baseDir = join(import.meta.dir, "../../..");
  const dataDir = join(baseDir, "data");
  const bookDir = join(dataDir, SLUG);
  const rawDir = join(bookDir, "raw");
  const localPath = join(rawDir, "source.html");

  let html: string;
  try {
    html = readFileSync(localPath, "utf-8");
    console.log("Using cached local copy of the book.");
  } catch {
    html = await fetchBook();
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(localPath, html);
    console.log("Cached raw HTML.");
  }

  console.log("Parsing chapters...");
  const parsed = parseBookWithParagraphRemaps(html);
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
