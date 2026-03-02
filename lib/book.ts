import { readFileSync, existsSync } from "fs";
import { join } from "path";
import "./data-manifest.ts";
import { getBookConfig, isBookSlug } from "./books";

export { getBookConfig, isBookSlug };

export interface ChapterSummary {
  number: number;
  title: string;
  volume: string;
}

export interface Chapter extends ChapterSummary {
  content: string;
}

/** Non-chapter section (preface, introduction, notes, etc.) with fixed order in TOC */
export interface Section {
  id: string;
  kind?: string;
  title: string;
  content: string;
}

export interface BookIndex {
  title: string;
  author: string;
  source: string;
  license: string;
  chapters: ChapterSummary[];
  frontMatter?: Section[];
  backMatter?: Section[];
}

export interface Book extends BookIndex {
  chapters: Chapter[];
}

/** One entry in table of contents: either a section or a chapter */
export type TocEntry =
  | { type: "section"; id: string; title: string; kind?: string }
  | { type: "chapter"; number: number; title: string; volume: string };

/** Ordered TOC: frontMatter → chapters → backMatter */
export function getTableOfContents(slug: string): TocEntry[] {
  const index = getBookIndex(slug);
  if (!index) return [];
  const entries: TocEntry[] = [];
  for (const s of index.frontMatter ?? []) {
    entries.push({ type: "section", id: s.id, title: s.title, kind: s.kind });
  }
  for (const ch of index.chapters) {
    entries.push({ type: "chapter", number: ch.number, title: ch.title, volume: ch.volume });
  }
  for (const s of index.backMatter ?? []) {
    entries.push({ type: "section", id: s.id, title: s.title, kind: s.kind });
  }
  return entries;
}

export function getSection(slug: string, sectionId: string): Section | undefined {
  const index = getBookIndex(slug);
  if (!index) return undefined;
  const front = index.frontMatter ?? [];
  const back = index.backMatter ?? [];
  return front.find((s) => s.id === sectionId) ?? back.find((s) => s.id === sectionId);
}

const DATA_DIR = join(process.cwd(), "data");
const CHAPTERS_DIRNAME = "chapters";

const indexCache = new Map<string, BookIndex>();
const bookCache = new Map<string, Book>();
const chapterCache = new Map<string, Chapter>();

function dataDirFor(slug: string): string {
  return join(DATA_DIR, slug);
}

function chapterFilePath(slug: string, chapterNumber: number): string {
  return join(dataDirFor(slug), CHAPTERS_DIRNAME, `${chapterNumber}.html`);
}

function chapterCacheKey(slug: string, chapterNumber: number): string {
  return `${slug}:${chapterNumber}`;
}

export function getBookIndex(slug: string): BookIndex | undefined {
  let cached = indexCache.get(slug);
  if (cached) return cached;
  const path = join(dataDirFor(slug), "book-index.json");
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf-8");
  cached = JSON.parse(raw) as BookIndex;
  indexCache.set(slug, cached);
  return cached;
}

export function getBook(slug: string): Book | undefined {
  let cached = bookCache.get(slug);
  if (cached) return cached;

  const index = getBookIndex(slug);
  if (!index) return undefined;

  const chapters: Chapter[] = [];
  for (const summary of index.chapters) {
    const path = chapterFilePath(slug, summary.number);
    if (!existsSync(path)) return undefined;
    const content = readFileSync(path, "utf-8");
    const chapter: Chapter = { ...summary, content };
    chapters.push(chapter);
    chapterCache.set(chapterCacheKey(slug, summary.number), chapter);
  }

  cached = {
    ...index,
    chapters,
  };
  bookCache.set(slug, cached);
  return cached;
}

export function getChapter(slug: string, number: number): Chapter | undefined {
  const key = chapterCacheKey(slug, number);
  let cached = chapterCache.get(key);
  if (cached) return cached;

  const index = getBookIndex(slug);
  if (!index) return undefined;
  const summary = index.chapters.find((chapter) => chapter.number === number);
  if (!summary) return undefined;

  const path = chapterFilePath(slug, number);
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, "utf-8");
  cached = { ...summary, content };
  chapterCache.set(key, cached);
  return cached;
}

/** Volume labels for display (from book config or derived from book-index) */
export function getVolumeLabels(slug: string): Record<string, string> {
  const config = getBookConfig(slug);
  if (config?.volumeLabels) return config.volumeLabels;
  const index = getBookIndex(slug);
  if (!index) return {};
  const labels: Record<string, string> = {};
  for (const ch of index.chapters) {
    if (ch.volume && !labels[ch.volume]) {
      labels[ch.volume] = ch.volume;
    }
  }
  return labels;
}
