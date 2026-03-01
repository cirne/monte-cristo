/**
 * Entity store: canonical list of people, places, and events discovered or
 * curated for the book. Used when indexing chapters so we can update
 * previously referenced entities instead of duplicating.
 */

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
}

export interface EntityStoreData {
  entities: Record<string, StoredEntity>;
  /** Last chapter number that was indexed (optional) */
  lastIndexedChapter?: number;
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
