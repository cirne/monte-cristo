#!/usr/bin/env bun
/**
 * Parser for The Great Gatsby.
 * Fetches Gutenberg HTML, splits by <div id="chapter-N">, sanitizes to canonical HTML
 * (preserving <p>, <strong>, <em>, etc.), writes chapters/*.html and book-index.json.
 */

import "../../../lib/loadEnv";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { writeCanonicalBook, type Book, type Chapter } from "../../../lib/canonical-book";
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

async function fetchBook(): Promise<string> {
  console.log("Fetching The Great Gatsby from Project Gutenberg...");
  const res = await fetch(HTML_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseBook(html: string): Book {
  const chapterSplits = splitChaptersFromHtml(html);
  if (chapterSplits.length === 0) {
    throw new Error("No chapters found (expected <div id=\"chapter-N\">)");
  }

  const volume = "Full";
  const chapters: Chapter[] = chapterSplits.map(({ number, title, content }) => ({
    number,
    title,
    volume,
    content,
  }));

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
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    source: "Project Gutenberg (https://www.gutenberg.org/ebooks/64317)",
    license: "Public Domain",
    chapters,
  };
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
  const book = parseBook(html);
  console.log(`Parsed ${book.chapters.length} chapters.`);

  writeCanonicalBook(dataDir, SLUG, book);
  console.log(`Wrote ${bookDir}/chapters/*.html and book-index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
