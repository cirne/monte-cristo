/**
 * Pure merge helpers used when writing the chapter index and entity store under lock.
 * Used by scripts/index-chapter.ts to merge our in-memory updates with re-read disk state.
 */

import type { ChapterIndex, ChapterIndexEntry } from "./chapter-index";
import type { EntityStoreData } from "./entity-store";

/** Merge our entity store updates into the re-read store. Pure; does not mutate inputs. */
export function mergeEntityStoreInto(
  reRead: EntityStoreData,
  ours: EntityStoreData
): EntityStoreData {
  const merged: EntityStoreData = {
    entities: { ...reRead.entities },
    lastIndexedChapter: reRead.lastIndexedChapter,
  };
  for (const [id, ourEntity] of Object.entries(ours.entities)) {
    const existing = merged.entities[id];
    if (existing) {
      merged.entities[id] = {
        ...existing,
        firstSeenInChapter: Math.min(existing.firstSeenInChapter, ourEntity.firstSeenInChapter),
        aliases: [...new Set([...existing.aliases, ...ourEntity.aliases])],
        searchTerms: [...new Set([...existing.searchTerms, ...ourEntity.searchTerms])],
        spoilerFreeIntro: existing.spoilerFreeIntro?.trim() || ourEntity.spoilerFreeIntro?.trim() || undefined,
        matchPatterns: existing.matchPatterns?.length ? existing.matchPatterns : ourEntity.matchPatterns,
      };
    } else {
      merged.entities[id] = { ...ourEntity };
    }
  }
  merged.lastIndexedChapter = Math.max(
    merged.lastIndexedChapter ?? 0,
    ours.lastIndexedChapter ?? 0
  );
  return merged;
}

/** Merge our chapter index updates into the re-read index for the chapters we processed. Pure. */
export function mergeChapterIndexInto(
  reRead: ChapterIndex,
  ours: ChapterIndex,
  chaptersWeProcessed: { number: number }[]
): ChapterIndex {
  const byNumber = new Map<number, ChapterIndexEntry>(
    reRead.chapters.map((c) => [c.number, { ...c }])
  );
  for (const { number } of chaptersWeProcessed) {
    const ourEntry = ours.chapters.find((c) => c.number === number);
    if (ourEntry) byNumber.set(number, { ...ourEntry });
  }
  const chapters = [...byNumber.values()].sort((a, b) => a.number - b.number);
  return { chapters };
}
