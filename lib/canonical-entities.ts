/**
 * Canonical entity ID mapping: deduplicate by (type, normalized name) using only the entity store.
 * Used to merge duplicate entities (e.g. "edmond_dants" vs "dantes") so linkify and chapter index stay consistent.
 */

import { normalizeNameForMatch } from "./entity-store";
import type { StoredEntity } from "./entity-store";

/** Overrides for known slug variations that don't match by name (e.g. LLM used different id). */
const ID_OVERRIDES: Record<string, string> = {
  edmond_dants: "dantes",
  m_danglars: "danglars",
  mercds: "mercedes",
  chteau_dif: "chateau_dif",
  notredame_de_la_garde: "notre_dame_garde",
  fort_saintjean: "fort_saint_jean",
  the_pharaon: "pharaon",
};

function pickCanonicalIdInGroup(entities: StoredEntity[]): string {
  if (entities.length === 0) return "";
  if (entities.length === 1) return entities[0].id;
  const byId = new Map(entities.map((e) => [e.id, e]));
  for (const e of entities) {
    const override = ID_OVERRIDES[e.id.toLowerCase()];
    if (override && byId.has(override)) return override;
  }
  const sorted = [...entities].sort(
    (a, b) =>
      a.firstSeenInChapter - b.firstSeenInChapter || a.id.localeCompare(b.id)
  );
  return sorted[0].id;
}

/**
 * Build mapping from every store entity ID to the canonical ID for its (type, normalized name) group.
 * Canonical = one id per group (earliest firstSeenInChapter, then lexicographic id; overrides applied when present).
 */
export function buildCanonicalMapping(
  store: { entities: Record<string, StoredEntity> }
): Map<string, string> {
  const map = new Map<string, string>();
  const groups = new Map<string, StoredEntity[]>();
  for (const e of Object.values(store.entities)) {
    const key = `${e.type}:${normalizeNameForMatch(e.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const canonicalByEntity = new Map<string, string>();
  for (const group of groups.values()) {
    const canonical = pickCanonicalIdInGroup(group);
    for (const e of group) {
      canonicalByEntity.set(e.id, canonical);
    }
  }

  for (const id of Object.keys(store.entities)) {
    const canonical = canonicalByEntity.get(id) ?? id;
    const override = ID_OVERRIDES[id.toLowerCase()];
    const resolved = override && store.entities[override] ? override : canonical;
    if (resolved !== id) map.set(id, resolved);
  }
  return map;
}

/**
 * Resolve an index/store entity ID to the canonical ID.
 * Prefer buildCanonicalMapping(store) for batch resolution.
 */
export function getCanonicalId(
  store: { entities: Record<string, StoredEntity> },
  entityId: string
): string | undefined {
  if (!entityId || typeof entityId !== "string") return undefined;
  if (!store.entities[entityId]) return undefined;
  const mapping = buildCanonicalMapping(store);
  return mapping.get(entityId) ?? entityId;
}
