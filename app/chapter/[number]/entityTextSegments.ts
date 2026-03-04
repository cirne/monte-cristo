export type EntityLinkableData = {
  name: string;
  aliases: string[];
};

export type EntityTextSegment =
  | { type: "text"; content: string }
  | { type: "entity"; content: string; entityId: string };

interface EntityPattern {
  pattern: string;
  entityId: string;
}

function buildEntityPatterns(
  entityData: Record<string, EntityLinkableData>,
  excludeEntityId?: string
): EntityPattern[] {
  const patterns: EntityPattern[] = [];

  for (const [entityId, data] of Object.entries(entityData)) {
    if (entityId === excludeEntityId) continue;

    if (data.name) {
      patterns.push({ pattern: data.name, entityId });
    }

    for (const alias of data.aliases) {
      if (alias) {
        patterns.push({ pattern: alias, entityId });
      }
    }
  }

  return patterns.sort((a, b) => b.pattern.length - a.pattern.length);
}

export function parseTextForEntityLinks(
  text: string,
  entityData: Record<string, EntityLinkableData>,
  excludeEntityId?: string
): EntityTextSegment[] {
  if (!text) return [];

  const patterns = buildEntityPatterns(entityData, excludeEntityId);
  if (patterns.length === 0) return [{ type: "text", content: text }];

  const segments: EntityTextSegment[] = [];
  let index = 0;

  while (index < text.length) {
    let matched: EntityPattern | null = null;

    for (const pattern of patterns) {
      const value = pattern.pattern;
      if (
        text.slice(index, index + value.length) === value &&
        (matched === null || value.length > matched.pattern.length)
      ) {
        matched = pattern;
      }
    }

    if (matched) {
      segments.push({
        type: "entity",
        content: matched.pattern,
        entityId: matched.entityId,
      });
      index += matched.pattern.length;
    } else {
      segments.push({ type: "text", content: text[index] });
      index += 1;
    }
  }

  const merged: EntityTextSegment[] = [];
  for (const segment of segments) {
    if (segment.type === "text" && merged[merged.length - 1]?.type === "text") {
      (merged[merged.length - 1] as { type: "text"; content: string }).content += segment.content;
      continue;
    }
    merged.push(segment);
  }

  return merged;
}
