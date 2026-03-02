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

const PAGE_MARKER_LINE = /^\d{3,6}m$/;
const LEGACY_PAGE_MARKER_PLACEHOLDER = "\u200B";

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

interface ParagraphIndexRemap {
  chapterNumber: number;
  sourceParagraphCount: number;
  targetParagraphCount: number;
  removedParagraphIndices: number[];
}

interface ParsedBookResult {
  book: Book;
  paragraphRemaps: ParagraphIndexRemap[];
}

interface SceneRangeLike {
  startParagraph: number;
  endParagraph: number;
}

interface ChapterIndexEntryLike {
  number: number;
  scenes?: SceneRangeLike[];
}

interface ChapterIndexLike {
  chapters: ChapterIndexEntryLike[];
}

function isStandalonePageMarkerLine(line: string): boolean {
  const trimmed = line.trim();
  return PAGE_MARKER_LINE.test(trimmed) || trimmed === LEGACY_PAGE_MARKER_PLACEHOLDER;
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

function isStandalonePageMarkerParagraph(paragraph: string): boolean {
  return isStandalonePageMarkerLine(paragraph);
}

/**
 * Remove Gutenberg printed-edition page marker lines (e.g. 0267m, 20009m)
 * and collapse surrounding blank lines so we don't emit empty paragraphs.
 */
export function stripStandalonePageMarkerParagraphs(content: string): string {
  return content
    .split("\n")
    .filter((line) => !isStandalonePageMarkerLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildParagraphIndexRemap(
  chapterNumber: number,
  sourceContent: string,
  targetContent: string
): ParagraphIndexRemap {
  const sourceParagraphs = splitParagraphs(sourceContent);
  const targetParagraphs = splitParagraphs(targetContent);
  const removedParagraphIndices: number[] = [];

  for (let i = 0; i < sourceParagraphs.length; i++) {
    if (isStandalonePageMarkerParagraph(sourceParagraphs[i])) {
      removedParagraphIndices.push(i);
    }
  }

  return {
    chapterNumber,
    sourceParagraphCount: sourceParagraphs.length,
    targetParagraphCount: targetParagraphs.length,
    removedParagraphIndices,
  };
}

function mapParagraphIndex(
  paragraphIndex: number,
  remap: ParagraphIndexRemap,
  preferStart: boolean
): number {
  if (remap.targetParagraphCount <= 0 || remap.sourceParagraphCount <= 0) return 0;

  const removed = remap.removedParagraphIndices;
  const removedSet = new Set(removed);
  let sourceIndex = Math.floor(paragraphIndex);
  if (!Number.isFinite(sourceIndex)) sourceIndex = 0;
  if (sourceIndex < 0) sourceIndex = 0;
  if (sourceIndex > remap.sourceParagraphCount - 1) sourceIndex = remap.sourceParagraphCount - 1;

  if (removedSet.has(sourceIndex)) {
    if (preferStart) {
      let forward = sourceIndex;
      while (forward < remap.sourceParagraphCount && removedSet.has(forward)) forward++;
      if (forward < remap.sourceParagraphCount) {
        sourceIndex = forward;
      } else {
        let backward = sourceIndex;
        while (backward >= 0 && removedSet.has(backward)) backward--;
        sourceIndex = Math.max(0, backward);
      }
    } else {
      let backward = sourceIndex;
      while (backward >= 0 && removedSet.has(backward)) backward--;
      if (backward >= 0) {
        sourceIndex = backward;
      } else {
        let forward = sourceIndex;
        while (forward < remap.sourceParagraphCount && removedSet.has(forward)) forward++;
        sourceIndex = Math.min(remap.sourceParagraphCount - 1, forward);
      }
    }
  }

  let removedBeforeOrAt = 0;
  for (const removedIndex of removed) {
    if (removedIndex <= sourceIndex) removedBeforeOrAt++;
    else break;
  }

  let mapped = sourceIndex - removedBeforeOrAt;
  if (mapped < 0) mapped = 0;
  if (mapped > remap.targetParagraphCount - 1) mapped = remap.targetParagraphCount - 1;
  return mapped;
}

export function remapChapterIndexScenes(
  index: ChapterIndexLike,
  paragraphRemaps: ParagraphIndexRemap[]
): { updatedIndex: ChapterIndexLike; chaptersTouched: number; scenesTouched: number } {
  const remapByChapter = new Map(
    paragraphRemaps
      .filter((remap) => remap.removedParagraphIndices.length > 0)
      .map((remap) => [remap.chapterNumber, remap] as const)
  );

  let chaptersTouched = 0;
  let scenesTouched = 0;

  const updatedIndex: ChapterIndexLike = {
    ...index,
    chapters: index.chapters.map((chapter) => {
      const remap = remapByChapter.get(chapter.number);
      if (!remap || !Array.isArray(chapter.scenes) || chapter.scenes.length === 0) {
        return chapter;
      }

      const hasOutOfBoundsScene = chapter.scenes.some(
        (scene) =>
          scene.startParagraph < 0 ||
          scene.endParagraph < 0 ||
          scene.startParagraph > remap.targetParagraphCount - 1 ||
          scene.endParagraph > remap.targetParagraphCount - 1
      );
      if (!hasOutOfBoundsScene) {
        return chapter;
      }

      let chapterChanged = false;
      const scenes = chapter.scenes.map((scene) => {
        const mappedStart = mapParagraphIndex(scene.startParagraph, remap, true);
        const mappedEndRaw = mapParagraphIndex(scene.endParagraph, remap, false);
        const mappedEnd = Math.max(mappedStart, mappedEndRaw);

        if (mappedStart !== scene.startParagraph || mappedEnd !== scene.endParagraph) {
          chapterChanged = true;
          scenesTouched++;
          return {
            ...scene,
            startParagraph: mappedStart,
            endParagraph: mappedEnd,
          };
        }

        return scene;
      });

      if (!chapterChanged) return chapter;
      chaptersTouched++;
      return {
        ...chapter,
        scenes,
      };
    }),
  };

  return {
    updatedIndex,
    chaptersTouched,
    scenesTouched,
  };
}

export function parseBookWithParagraphRemaps(raw: string): ParsedBookResult {
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
  const paragraphRemaps: ParagraphIndexRemap[] = [];

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
    const sourceContent = chapterText.slice(contentStart).trim();
    let content = sourceContent;

    // Remove standalone PG printed-edition page marker paragraphs so we don't
    // emit empty <p></p> blocks between real paragraphs.
    content = stripStandalonePageMarkerParagraphs(content);
    paragraphRemaps.push(buildParagraphIndexRemap(number, sourceContent, content));

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

export function parseBook(raw: string): Book {
  return parseBookWithParagraphRemaps(raw).book;
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
  const parsed = parseBookWithParagraphRemaps(raw);
  const book = parsed.book;
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

  const chapterIndexPath = join(dataDir, "chapter-index.json");
  if (existsSync(chapterIndexPath)) {
    const chapterIndex = JSON.parse(readFileSync(chapterIndexPath, "utf-8")) as ChapterIndexLike;
    const { updatedIndex, chaptersTouched, scenesTouched } = remapChapterIndexScenes(
      chapterIndex,
      parsed.paragraphRemaps
    );
    if (scenesTouched > 0) {
      writeFileSync(chapterIndexPath, JSON.stringify(updatedIndex, null, 2));
      console.log(
        `Updated ${chapterIndexPath} scene ranges (${scenesTouched} scenes across ${chaptersTouched} chapters).`
      );
    } else {
      console.log("No chapter-index scene range updates were needed.");
    }
  }
}

const moduleMeta = import.meta as ImportMeta & { main?: boolean };
if (moduleMeta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
