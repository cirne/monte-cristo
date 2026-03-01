import { readFileSync, existsSync } from "fs";
import { join } from "path";
import "./data-manifest";
import type { SceneWithDetails } from "./scenes";

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
  /** Paragraph-index based scenes; when from LLM, includes locationDescription, imageDescription, characterIds */
  scenes?: SceneWithDetails[];
}

export interface ChapterIndex {
  chapters: ChapterIndexEntry[];
}

const DATA_DIR = join(process.cwd(), "data");
let _index: ChapterIndex | null = null;

export function getChapterIndex(): ChapterIndex {
  if (!_index) {
    const path = join(DATA_DIR, "chapter-index.json");
    if (!existsSync(path)) {
      _index = { chapters: [] };
    } else {
      const raw = readFileSync(path, "utf-8");
      _index = JSON.parse(raw) as ChapterIndex;
    }
  }
  return _index;
}

export function getChapterIndexEntry(chapterNumber: number): ChapterIndexEntry | undefined {
  return getChapterIndex().chapters.find((c) => c.number === chapterNumber);
}
