#!/usr/bin/env bun
/**
 * One-time script to patch imageSubtitle into existing scenes without regenerating anything else.
 * Reads chapter-index.json, finds scenes missing imageSubtitle, generates them, and saves back.
 * Uses parallel LLM calls for faster processing.
 *
 * Usage:
 *   bun run scripts/patch-scene-subtitles.ts --book=monte-cristo --chapter=5
 *   bun run scripts/patch-scene-subtitles.ts --book=monte-cristo --all [--workers=10] [--overwrite]
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as lockfile from "proper-lockfile";
import type { LockOptions } from "proper-lockfile";
import { createChatCompletion } from "../lib/llm";
import { getParagraphs } from "../lib/scenes";
import type { SceneWithDetails } from "../lib/scenes";
import type { ChapterIndex, ChapterIndexEntry } from "../lib/chapter-index";
import { mergeChapterIndexInto } from "../lib/index-write-merge";
import { getBook } from "../lib/book";
import { DEFAULT_BOOK_SLUG, getBookConfig, isBookSlug } from "../lib/books";

const ROOT = join(import.meta.dir, "..");
const DATA_DIR = join(ROOT, "data");

const LOCK_STALE_MS = 60_000;
const LOCK_RETRIES = { retries: 30, factor: 1.5, minTimeout: 1000, maxTimeout: 15_000 };

function dataDirFor(slug: string): string {
  return join(DATA_DIR, slug);
}

/** Options for proper-lockfile when guarding the book index. */
function getLockOptions(dataDir: string): LockOptions {
  return {
    stale: LOCK_STALE_MS,
    retries: LOCK_RETRIES,
    lockfilePath: join(dataDir, ".index.lock"),
    realpath: false,
    onCompromised: (err) => {
      console.error("Index lock compromised:", err);
      throw err;
    },
  };
}

/** Acquire lock on dataDir, run fn, release in finally. Manages mkdir, lock, and release. */
async function withIndexLock<T>(dataDir: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(dataDir, { recursive: true });
  const release = await lockfile.lock(dataDir, getLockOptions(dataDir));
  try {
    return await fn();
  } finally {
    await release();
  }
}

function getSceneText(content: string, startParagraph: number, endParagraph: number): string {
  const paragraphs = getParagraphs(content);
  const slice = paragraphs.slice(startParagraph, endParagraph + 1);
  return slice.join("\n\n");
}

async function generateSubtitle(
  sceneText: string,
  chapterNumber: number,
  sceneIndex: number,
  bookTitle: string,
  locationDescription?: string
): Promise<string> {
  const context = locationDescription
    ? `Location: ${locationDescription}\n\n`
    : "";
  
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You write a brief caption (1 short sentence, under 80 characters) suitable to display under a scene image from "${bookTitle}".
This should be spoiler-free and descriptive of what's happening in the scene. You can use character names since this is for human readers.
Examples: "Dantès receives news of his promotion" or "The Pharaon docks in Marseille".
Output only the subtitle text, no explanation or quotes.`,
      },
      {
        role: "user",
        content: `${context}Chapter ${chapterNumber}, scene ${sceneIndex + 1}:\n\n${sceneText.slice(0, 2000)}`,
      },
    ],
    max_tokens: 60,
  });

  const subtitle = response.choices[0]?.message?.content?.trim();
  if (!subtitle) throw new Error("Empty LLM response for subtitle");
  
  // Remove quotes if LLM added them
  return subtitle.replace(/^["']|["']$/g, "").trim();
}

async function patchSubtitlesForChapter(
  bookSlug: string,
  chapterNumber: number,
  bookTitle: string,
  workers: number,
  overwrite: boolean
): Promise<number> {
  const book = getBook(bookSlug);
  if (!book) {
    console.error(`Book ${bookSlug} not found`);
    return 0;
  }

  const chapter = book.chapters.find((c) => c.number === chapterNumber);
  if (!chapter) {
    console.error(`Chapter ${chapterNumber} not found`);
    return 0;
  }

  const dataDir = dataDirFor(bookSlug);
  const indexPath = join(dataDir, "chapter-index.json");
  if (!existsSync(indexPath)) {
    console.error(`Chapter index not found: ${indexPath}`);
    return 0;
  }

  // Read index initially to check what needs work (before lock)
  const initialIndex: ChapterIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
  const initialEntry = initialIndex.chapters.find((c) => c.number === chapterNumber);
  if (!initialEntry || !initialEntry.scenes?.length) {
    console.log(`Chapter ${chapterNumber}: no scenes found`);
    return 0;
  }

  // Collect scenes that need subtitles
  const scenesNeedingSubtitles: Array<{
    index: number;
    scene: SceneWithDetails;
    sceneText: string;
  }> = [];

  for (let i = 0; i < initialEntry.scenes.length; i++) {
    const scene = initialEntry.scenes[i];
    if (overwrite || !scene.imageSubtitle?.trim()) {
      const sceneText = getSceneText(
        chapter.content,
        scene.startParagraph,
        scene.endParagraph
      );
      scenesNeedingSubtitles.push({ index: i, scene, sceneText });
    }
  }

  if (scenesNeedingSubtitles.length === 0) {
    console.log(`✓ Chapter ${chapterNumber} already has all subtitles`);
    return 0;
  }

  console.log(
    `  Generating ${scenesNeedingSubtitles.length} subtitle(s) for chapter ${chapterNumber}...`
  );

  // Generate subtitles in parallel batches (outside lock)
  const subtitleResults: Array<{ index: number; subtitle: string }> = [];
  for (let i = 0; i < scenesNeedingSubtitles.length; i += workers) {
    const chunk = scenesNeedingSubtitles.slice(i, i + workers);
    const results = await Promise.all(
      chunk.map(async ({ index, scene, sceneText }) => {
        try {
          const subtitle = await generateSubtitle(
            sceneText,
            chapterNumber,
            index,
            bookTitle,
            scene.locationDescription
          );
          return { index, subtitle };
        } catch (e) {
          console.error(`    Error generating subtitle for scene ${index}: ${e}`);
          return null;
        }
      })
    );
    for (const result of results) {
      if (result) {
        subtitleResults.push(result);
        console.log(`    Scene ${result.index}: "${result.subtitle}"`);
      }
    }
  }

  if (subtitleResults.length === 0) {
    return 0;
  }

  // Now acquire lock, re-read, merge, and write
  return await withIndexLock(dataDir, async () => {
    // Re-read index after acquiring lock
    let reReadIndex: ChapterIndex = { chapters: [] };
    if (existsSync(indexPath)) {
      reReadIndex = JSON.parse(readFileSync(indexPath, "utf-8")) as ChapterIndex;
    }

    const reReadEntry = reReadIndex.chapters.find((c) => c.number === chapterNumber);
    if (!reReadEntry || !reReadEntry.scenes?.length) {
      console.warn(`Chapter ${chapterNumber} entry disappeared after lock`);
      return 0;
    }

    // Apply subtitles to scenes (only update scenes that we generated subtitles for)
    const updatedScenes: SceneWithDetails[] = reReadEntry.scenes.map((scene) => ({ ...scene }));
    const subtitleIndexSet = new Set(subtitleResults.map((r) => r.index));
    for (const { index, subtitle } of subtitleResults) {
      if (index < updatedScenes.length) {
        updatedScenes[index].imageSubtitle = subtitle;
      }
    }

    // Create updated entry
    const updatedEntry: ChapterIndexEntry = {
      ...reReadEntry,
      scenes: updatedScenes,
    };

    // Merge using the same pattern as index-chapter.ts
    const ourIndex: ChapterIndex = {
      chapters: [updatedEntry],
    };
    const mergedIndex = mergeChapterIndexInto(reReadIndex, ourIndex, [{ number: chapterNumber }]);

    // Write merged index
    writeFileSync(indexPath, JSON.stringify(mergedIndex, null, 2));
    console.log(`✓ Patched ${subtitleResults.length} subtitle(s) for chapter ${chapterNumber}`);

    return subtitleResults.length;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const bookArg = args.find((a) => a.startsWith("--book="));
  const bookSlug = bookArg ? bookArg.split("=")[1]?.trim() : DEFAULT_BOOK_SLUG;
  
  if (!bookSlug || !isBookSlug(bookSlug)) {
    console.error(
      `Invalid or missing --book=. Use --book=<slug> (e.g. bun run scripts/patch-scene-subtitles.ts --book=${DEFAULT_BOOK_SLUG} --chapter=5)`
    );
    process.exit(1);
  }

  const config = getBookConfig(bookSlug)!;
  const bookTitle = config.title;

  const chapterArg = args.find((a) => a.startsWith("--chapter="));
  const chapterNum = chapterArg ? parseInt(chapterArg.split("=")[1], 10) : null;
  const all = args.includes("--all");
  const overwrite = args.includes("--overwrite") || args.includes("--overwrite-existing");
  const workersArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const workers = workersArg ? Math.max(1, parseInt(workersArg, 10)) : 10;

  if (!all && (chapterNum == null || isNaN(chapterNum))) {
    console.error(
      "Usage: bun run scripts/patch-scene-subtitles.ts --book=<slug> --chapter=5 | --all [--workers=N] [--overwrite]"
    );
    process.exit(1);
  }

  const book = getBook(bookSlug);
  if (!book) {
    console.error(`Book ${bookSlug} not found. Run parse-book first.`);
    process.exit(1);
  }

  if (workers !== 10) {
    console.log(`Using ${workers} parallel workers for subtitle generation.`);
  }
  if (overwrite) {
    console.log("Overwrite mode: regenerating subtitles for all scenes.");
  }

  if (all) {
    console.log(`Patching subtitles for all chapters in ${bookTitle}...`);
    
    // Process chapters sequentially to avoid lock contention
    // (Each chapter acquires its own lock, so parallel processing could cause delays)
    let totalPatched = 0;
    for (const chapter of book.chapters) {
      const patched = await patchSubtitlesForChapter(
        bookSlug,
        chapter.number,
        bookTitle,
        workers,
        overwrite
      );
      totalPatched += patched;
    }
    
    console.log(`\n✓ Total: patched ${totalPatched} subtitle(s) across all chapters`);
  } else {
    await patchSubtitlesForChapter(bookSlug, chapterNum!, bookTitle, workers, overwrite);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
