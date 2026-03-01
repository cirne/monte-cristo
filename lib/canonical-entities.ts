/**
 * Canonical entity ID mapping: index/store IDs → curated IDs.
 * Used to consolidate data and make linkify work without re-running the LLM.
 */

import { CHARACTERS, getCharacter } from "./characters";
import { PLACES_AND_EVENTS, getPlaceOrEvent } from "./entities";
import { normalizeNameForMatch } from "./entity-store";
import type { EntityType } from "./chapter-index";
import type { StoredEntity } from "./entity-store";

/** Explicit overrides for known slug variations that don't match by name */
const ID_OVERRIDES: Record<string, string> = {
  edmond_dants: "dantes",
  m_danglars: "danglars",
  mercds: "mercedes",
  chteau_dif: "chateau_dif",
  notredame_de_la_garde: "notre_dame_garde",
  fort_saintjean: "fort_saint_jean",
  the_pharaon: "pharaon",
};

/**
 * Resolve an index/store entity ID to the canonical (curated) ID when possible.
 * Returns the canonical id if we have a curated person/place/event for it; otherwise returns undefined (keep original).
 */
export function getCanonicalId(
  entityId: string,
  type: EntityType,
  storeEntity?: StoredEntity | null
): string | undefined {
  if (!entityId || typeof entityId !== "string") return undefined;
  const lower = entityId.toLowerCase().trim();

  if (ID_OVERRIDES[lower]) return ID_OVERRIDES[lower];

  if (getCharacter(entityId) || getPlaceOrEvent(entityId)) return entityId;

  const name = storeEntity?.name?.trim();
  if (!name) return undefined;

  if (type === "person") {
    const norm = normalizeNameForMatch(name);
    for (const c of CHARACTERS) {
      if (normalizeNameForMatch(c.name) === norm) return c.id;
      for (const a of c.aliases || []) {
        if (normalizeNameForMatch(a) === norm) return c.id;
      }
    }
  }

  if (type === "place" || type === "event") {
    const norm = normalizeNameForMatch(name);
    for (const e of PLACES_AND_EVENTS) {
      if (normalizeNameForMatch(e.name) === norm) return e.id;
      for (const t of e.searchTerms || []) {
        if (normalizeNameForMatch(t) === norm) return e.id;
      }
    }
  }

  return undefined;
}

/**
 * Build full mapping from all store entity IDs to canonical IDs.
 */
export function buildCanonicalMapping(store: { entities: Record<string, StoredEntity> }): Map<string, string> {
  const map = new Map<string, string>();
  for (const [id, e] of Object.entries(store.entities)) {
    const canonical = getCanonicalId(id, e.type, e);
    if (canonical) map.set(id, canonical);
  }
  return map;
}
