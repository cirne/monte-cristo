/**
 * Canonical book types and helpers for parser scripts.
 * Parsers build a Book (using these types) and call writeCanonicalBook to emit canonical files.
 */

import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { Book, BookIndex, Chapter, ChapterSummary, Section } from "./book";
import { getParagraphs } from "./scenes";
import { formatCanonicalHtmlForStorage } from "./canonical-html";

export type { Book, BookIndex, Chapter, ChapterSummary, Section };

/** Split content into paragraphs (same as indexer/scenes). */
export function splitParagraphs(content: string): string[] {
  return getParagraphs(content);
}

const PAGE_MARKER_LINE = /^\d{3,6}m$/;
const LEGACY_PAGE_MARKER_PLACEHOLDER = "\u200B";

function isStandalonePageMarkerLine(line: string): boolean {
  const trimmed = line.trim();
  return PAGE_MARKER_LINE.test(trimmed) || trimmed === LEGACY_PAGE_MARKER_PLACEHOLDER;
}

/**
 * Remove Gutenberg printed-edition page marker lines (e.g. 0267m, 20009m)
 * and collapse surrounding blank lines.
 */
export function stripPageMarkerLines(content: string): string {
  return content
    .split("\n")
    .filter((line) => !isStandalonePageMarkerLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** For remapChapterIndexScenes: which paragraph indices were removed in a chapter. */
export interface ParagraphIndexRemap {
  chapterNumber: number;
  sourceParagraphCount: number;
  targetParagraphCount: number;
  removedParagraphIndices: number[];
}

/** Build remap when target content had page-marker paragraphs stripped. */
export function buildParagraphIndexRemap(
  chapterNumber: number,
  sourceContent: string,
  targetContent: string
): ParagraphIndexRemap {
  const sourceParagraphs = splitParagraphs(sourceContent);
  const targetParagraphs = splitParagraphs(targetContent);
  const removedParagraphIndices: number[] = [];

  for (let i = 0; i < sourceParagraphs.length; i++) {
    const trimmed = sourceParagraphs[i].trim();
    if (PAGE_MARKER_LINE.test(trimmed) || trimmed === LEGACY_PAGE_MARKER_PLACEHOLDER) {
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

/** Minimal chapter index shape for remap (avoids importing full chapter-index). */
export interface ChapterIndexLike {
  chapters: Array<{
    number: number;
    scenes?: Array<{ startParagraph: number; endParagraph: number }>;
  }>;
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

/**
 * Update scene paragraph ranges when a parser stripped content (e.g. page markers).
 * Returns updated index and counts of touched chapters/scenes.
 */
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

/**
 * Write canonical book files to data/<slug>/:
 * - chapter content files: chapters/<number>.html
 * - metadata index: book-index.json
 * Creates/refreshes the chapter content directory.
 */
export function writeCanonicalBook(dataDir: string, slug: string, book: Book): void {
  const bookDir = join(dataDir, slug);
  mkdirSync(bookDir, { recursive: true });

  const chaptersDir = join(bookDir, "chapters");
  rmSync(chaptersDir, { recursive: true, force: true });
  mkdirSync(chaptersDir, { recursive: true });
  for (const chapter of book.chapters) {
    const formatted = formatCanonicalHtmlForStorage(chapter.content);
    writeFileSync(join(chaptersDir, `${chapter.number}.html`), formatted, "utf-8");
  }

  const legacyBookPath = join(bookDir, "book.json");
  if (existsSync(legacyBookPath)) {
    unlinkSync(legacyBookPath);
  }

  const index: BookIndex = {
    title: book.title,
    author: book.author,
    source: book.source,
    license: book.license,
    chapters: book.chapters.map(({ number, title, volume }) => ({ number, title, volume })),
    frontMatter: book.frontMatter,
    backMatter: book.backMatter,
  };
  const indexPath = join(bookDir, "book-index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
}
