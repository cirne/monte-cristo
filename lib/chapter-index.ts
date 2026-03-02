import { readFileSync, existsSync } from "fs";
import { join } from "path";
import "./data-manifest";
import type { SceneWithDetails } from "./scenes";
import { buildCanonicalMapping } from "./canonical-entities";
import { getEntityStore } from "./entity-store";

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
  /** One-paragraph summary of this chapter (spoiler-safe as of chapter end). */
  chapterSummary?: string;
  /** Rolling summary through the end of this chapter. */
  storySoFarSummary?: string;
  entities: ChapterIndexEntity[];
  /** Paragraph-index based scenes; when from LLM, includes locationDescription, imageDescription, characterIds */
  scenes?: SceneWithDetails[];
}

export interface ChapterIndex {
  chapters: ChapterIndexEntry[];
}

const DATA_DIR = join(process.cwd(), "data");
let _index: ChapterIndex | null = null;

function canonicalizeChapterIndex(index: ChapterIndex): ChapterIndex {
  const canonicalById = buildCanonicalMapping(getEntityStore());
  if (canonicalById.size === 0) return index;

  return {
    chapters: index.chapters.map((chapter) => {
      const entitiesByKey = new Map<string, ChapterIndexEntity>();
      for (const entity of chapter.entities) {
        const canonicalId = canonicalById.get(entity.entityId) ?? entity.entityId;
        const key = `${entity.type}:${canonicalId}`;
        const existing = entitiesByKey.get(key);
        if (existing) {
          existing.firstSeenInChapter = Math.min(existing.firstSeenInChapter, entity.firstSeenInChapter);
          if (!existing.excerpt && entity.excerpt) existing.excerpt = entity.excerpt;
        } else {
          entitiesByKey.set(key, { ...entity, entityId: canonicalId });
        }
      }

      const scenes = chapter.scenes?.map((scene) => {
        if (!scene.characterIds?.length) return scene;
        const canonicalIds = scene.characterIds.map((id) => canonicalById.get(id) ?? id);
        return { ...scene, characterIds: [...new Set(canonicalIds)] };
      });

      return {
        ...chapter,
        entities: [...entitiesByKey.values()],
        ...(scenes ? { scenes } : {}),
      };
    }),
  };
}

export function getChapterIndex(): ChapterIndex {
  if (!_index) {
    const path = join(DATA_DIR, "chapter-index.json");
    if (!existsSync(path)) {
      _index = { chapters: [] };
    } else {
      const raw = readFileSync(path, "utf-8");
      _index = canonicalizeChapterIndex(JSON.parse(raw) as ChapterIndex);
    }
  }
  return _index;
}

export function getChapterIndexEntry(chapterNumber: number): ChapterIndexEntry | undefined {
  return getChapterIndex().chapters.find((c) => c.number === chapterNumber);
}
