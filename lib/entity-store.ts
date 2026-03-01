/**
 * Entity store: canonical list of people, places, and events discovered or
 * curated for the book. Used when indexing chapters so we can update
 * previously referenced entities instead of duplicating.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { EntityType } from "./chapter-index";

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
let _store: EntityStoreData | null = null;

export function getEntityStore(): EntityStoreData {
  if (!_store) {
    const path = join(DATA_DIR, "entity-store.json");
    if (!existsSync(path)) {
      _store = { entities: {} };
    } else {
      const raw = readFileSync(path, "utf-8");
      _store = JSON.parse(raw) as EntityStoreData;
    }
  }
  return _store;
}

export function getStoredEntity(id: string): StoredEntity | undefined {
  return getEntityStore().entities[id];
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
