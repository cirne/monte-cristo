import { readFileSync } from "fs";
import { join } from "path";
import type { Scene } from "./scenes";

export type EntityType = "person" | "place" | "event";

export interface ChapterIndexEntity {
  entityId: string;
  type: EntityType;
  firstSeenInChapter: number;
  excerpt?: string;
}

export interface ChapterIndexEntry {
  number: number;
  baselineIntro?: string;
  entities: ChapterIndexEntity[];
  /** Paragraph-index based scenes; present when built with scene delineation */
  scenes?: Scene[];
}

export interface ChapterIndex {
  chapters: ChapterIndexEntry[];
}

const DATA_DIR = join(process.cwd(), "data");
let _index: ChapterIndex | null = null;

export function getChapterIndex(): ChapterIndex {
  if (!_index) {
    const raw = readFileSync(join(DATA_DIR, "chapter-index.json"), "utf-8");
    _index = JSON.parse(raw) as ChapterIndex;
  }
  return _index;
}

export function getChapterIndexEntry(chapterNumber: number): ChapterIndexEntry | undefined {
  return getChapterIndex().chapters.find((c) => c.number === chapterNumber);
}
