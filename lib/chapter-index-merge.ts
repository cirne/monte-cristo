import type { ChapterIndexEntry, ChapterIndexEntity } from "./chapter-index";
import type { SceneWithDetails } from "./scenes";

interface MergeChapterEntryOptions {
  /** When true, replace existing chapter entry entirely (destructive). */
  overwriteExisting?: boolean;
}

function cloneEntity(entity: ChapterIndexEntity): ChapterIndexEntity {
  return { ...entity };
}

function cloneScene(scene: SceneWithDetails): SceneWithDetails {
  return {
    ...scene,
    ...(scene.characterIds ? { characterIds: [...scene.characterIds] } : {}),
  };
}

function entityKey(entity: ChapterIndexEntity): string {
  return `${entity.entityId}::${entity.type}`;
}

/**
 * Non-destructive entity merge:
 * - keeps existing entities even when incoming list is sparse/empty
 * - adds new entities from incoming list
 * - updates known entities without regressing firstSeenInChapter
 */
export function mergeChapterEntities(
  existing: ChapterIndexEntity[],
  incoming: ChapterIndexEntity[]
): ChapterIndexEntity[] {
  const keysInOrder: string[] = [];
  const byKey = new Map<string, ChapterIndexEntity>();

  for (const entity of existing) {
    const key = entityKey(entity);
    if (!byKey.has(key)) keysInOrder.push(key);
    byKey.set(key, cloneEntity(entity));
  }

  for (const entity of incoming) {
    const key = entityKey(entity);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, cloneEntity(entity));
      keysInOrder.push(key);
      continue;
    }

    byKey.set(key, {
      ...prev,
      firstSeenInChapter: Math.min(prev.firstSeenInChapter, entity.firstSeenInChapter),
      excerpt: entity.excerpt?.trim() ? entity.excerpt : prev.excerpt,
    });
  }

  return keysInOrder.map((key) => byKey.get(key)!).filter(Boolean);
}

/**
 * Non-destructive scene merge:
 * - keeps existing scene boundaries by default
 * - backfills missing metadata from incoming scenes
 * - appends additional incoming scenes (additive)
 */
export function mergeChapterScenes(
  existing?: SceneWithDetails[],
  incoming?: SceneWithDetails[]
): SceneWithDetails[] | undefined {
  if (!existing?.length) return incoming?.length ? incoming.map(cloneScene) : undefined;
  if (!incoming?.length) return existing.map(cloneScene);

  const merged = existing.map(cloneScene);
  for (let i = 0; i < incoming.length; i++) {
    const next = incoming[i];
    const current = merged[i];
    if (!current) {
      merged.push(cloneScene(next));
      continue;
    }

    merged[i] = {
      ...current,
      locationDescription: current.locationDescription?.trim()
        ? current.locationDescription
        : next.locationDescription,
      imageDescription: current.imageDescription?.trim()
        ? current.imageDescription
        : next.imageDescription,
      characterIds: current.characterIds?.length
        ? [...new Set(current.characterIds)]
        : (next.characterIds ? [...new Set(next.characterIds)] : undefined),
    };
  }

  return merged;
}

/**
 * Merge/replace chapter entries. Default behavior is non-destructive patching.
 */
export function mergeChapterIndexEntry(
  existing: ChapterIndexEntry | undefined,
  incoming: ChapterIndexEntry,
  options: MergeChapterEntryOptions = {}
): ChapterIndexEntry {
  if (options.overwriteExisting || !existing) {
    return {
      ...incoming,
      entities: incoming.entities.map(cloneEntity),
      scenes: incoming.scenes?.map(cloneScene),
    };
  }

  return {
    number: incoming.number,
    baselineIntro: existing.baselineIntro ?? incoming.baselineIntro,
    entities: mergeChapterEntities(existing.entities, incoming.entities),
    scenes: mergeChapterScenes(existing.scenes, incoming.scenes),
  };
}
