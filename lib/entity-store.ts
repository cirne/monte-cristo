/**
 * Entity store: canonical list of people, places, and events for the book.
 * Populated by the indexer; used when indexing so the LLM reuses IDs and we dedupe by name.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { EntityType } from "./chapter-index";
import { DEFAULT_BOOK_SLUG } from "./books";

export interface StoredEntity {
  id: string;
  name: string;
  aliases: string[];
  type: EntityType;
  /** First chapter number where this entity appears */
  firstSeenInChapter: number;
  /** Spoiler-free one-line intro for X-Ray (e.g. first appearance context) */
  spoilerFreeIntro?: string;
  /** Terms to search for in text (name + aliases + extras) */
  searchTerms: string[];
  /** Optional regex patterns for canonical matching (e.g. M. Morrel, Monsieur Morrel → same entity) */
  matchPatterns?: string[];
}

export interface EntityStoreData {
  entities: Record<string, StoredEntity>;
  /** Last chapter number that was indexed (optional) */
  lastIndexedChapter?: number;
}

const DATA_DIR = join(process.cwd(), "data");
const storeCache = new Map<string, EntityStoreData>();

function dataDirFor(slug: string): string {
  return join(DATA_DIR, slug);
}

export function getEntityStore(slug: string = DEFAULT_BOOK_SLUG): EntityStoreData {
  let cached = storeCache.get(slug);
  if (!cached) {
    const path = join(dataDirFor(slug), "entity-store.json");
    if (!existsSync(path)) {
      cached = { entities: {} };
    } else {
      const raw = readFileSync(path, "utf-8");
      cached = JSON.parse(raw) as EntityStoreData;
    }
    storeCache.set(slug, cached);
  }
  return cached;
}

export function getStoredEntity(slug: string, id: string): StoredEntity | undefined;
export function getStoredEntity(id: string): StoredEntity | undefined;
export function getStoredEntity(slugOrId: string, id?: string): StoredEntity | undefined {
  if (id !== undefined) {
    return getEntityStore(slugOrId).entities[id];
  }
  return getEntityStore(DEFAULT_BOOK_SLUG).entities[slugOrId];
}

/** Slug for entity id: lowercase, alphanumeric + underscore */
export function slugifyEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "entity";
}

/**
 * Normalize name for matching: trim, collapse spaces, optional lowercase.
 * Used to match "M. de Villefort" to "de Villefort" etc.
 */
export function normalizeNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
