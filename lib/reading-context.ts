import { getChapter } from "./book";
import { getChapterIndex, getChapterIndexEntry, type ChapterIndexEntry } from "./chapter-index";
import { getParagraphs, normalizeScenes, type SceneWithDetails } from "./scenes";

const CHARS_PER_TOKEN = 4;

export interface ResolvedReadingPosition {
  chapterNumber: number;
  paragraphIndex: number;
  paragraphs: string[];
  indexEntry?: ChapterIndexEntry;
  scenes: SceneWithDetails[];
  sceneIndex: number;
  scene: SceneWithDetails;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function trimToTokenBudget(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return "";
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  if (maxChars < 2) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 1)}…`;
}

function clampParagraphIndex(paragraphIndex: number, paragraphCount: number): number {
  if (paragraphCount <= 0) return 0;
  if (!Number.isFinite(paragraphIndex)) return 0;
  const n = Math.floor(paragraphIndex);
  if (n < 0) return 0;
  if (n > paragraphCount - 1) return paragraphCount - 1;
  return n;
}

function findSceneIndexByParagraph(scenes: SceneWithDetails[], paragraphIndex: number): number {
  const idx = scenes.findIndex(
    (scene) => paragraphIndex >= scene.startParagraph && paragraphIndex <= scene.endParagraph
  );
  if (idx >= 0) return idx;
  return scenes.length > 0 ? scenes.length - 1 : 0;
}

export function resolveReadingPosition(
  chapterNumber: number,
  paragraphIndex: number
): ResolvedReadingPosition {
  const chapter = getChapter(chapterNumber);
  if (!chapter) {
    throw new Error(`Chapter ${chapterNumber} not found`);
  }

  const paragraphs = getParagraphs(chapter.content);
  if (paragraphs.length === 0) {
    throw new Error(`Chapter ${chapterNumber} has no paragraphs`);
  }

  const clampedParagraph = clampParagraphIndex(paragraphIndex, paragraphs.length);
  const indexEntry = getChapterIndexEntry(chapterNumber);
  const scenes = normalizeScenes(indexEntry?.scenes, paragraphs.length);
  const sceneIndex = findSceneIndexByParagraph(scenes, clampedParagraph);
  const scene = scenes[sceneIndex] ?? {
    startParagraph: 0,
    endParagraph: paragraphs.length - 1,
  };

  return {
    chapterNumber,
    paragraphIndex: clampedParagraph,
    paragraphs,
    indexEntry,
    scenes,
    sceneIndex,
    scene,
  };
}

export function getSceneTextUpToParagraph(
  position: ResolvedReadingPosition,
  maxTokens?: number
): string {
  const { paragraphs, scene, paragraphIndex } = position;
  const text = paragraphs.slice(scene.startParagraph, paragraphIndex + 1).join("\n\n");
  if (typeof maxTokens !== "number") return text;
  return trimToTokenBudget(text, maxTokens);
}

export function getSceneSummariesBeforeCurrent(position: ResolvedReadingPosition): string[] {
  return position.scenes
    .slice(0, position.sceneIndex)
    .map((scene, idx) => ({
      idx,
      summary: scene.summary?.trim(),
    }))
    .filter((entry): entry is { idx: number; summary: string } => Boolean(entry.summary))
    .map((entry) => `Scene ${entry.idx + 1}: ${entry.summary}`);
}

export function getChapterSummaryWindowBefore(
  chapterNumber: number,
  maxChapters: number
): string[] {
  if (chapterNumber <= 1 || maxChapters <= 0) return [];
  const start = Math.max(1, chapterNumber - maxChapters);
  const index = getChapterIndex();
  const byNumber = new Map(index.chapters.map((entry) => [entry.number, entry]));
  const summaries: string[] = [];
  for (let n = start; n <= chapterNumber - 1; n++) {
    const entry = byNumber.get(n);
    const summary = entry?.chapterSummary?.trim();
    if (!summary) continue;
    summaries.push(`Chapter ${n}: ${summary}`);
  }
  return summaries;
}

export function getStorySoFarBeforeChapter(
  chapterNumber: number,
  fallbackWindowChapters = 6
): string | undefined {
  if (chapterNumber <= 1) return undefined;
  const prev = getChapterIndexEntry(chapterNumber - 1);
  const rolling = prev?.storySoFarSummary?.trim();
  if (rolling) return rolling;

  const fallback = getChapterSummaryWindowBefore(chapterNumber, fallbackWindowChapters);
  if (fallback.length === 0) return undefined;
  return fallback.join("\n");
}
