/**
 * LLM indexing for a single visible-page chunk from an external reader.
 * Simplified relative to scripts/index-chapter.ts (page-sized text, no chapter HTML).
 */

import type { EntityType } from "./chapter-index";
import { createFastChatCompletion } from "./llm";
import {
  type CompanionBookStore,
  mergeCompanionEntity,
} from "./companion-brain";

export interface ChunkIndexResult {
  entities: Array<{
    name: string;
    type: EntityType;
    alias?: string;
    id?: string;
    spoilerFreeIntro?: string;
  }>;
  currentSummary: string;
  storySoFar: string;
}

interface RawEntity {
  name?: unknown;
  type?: unknown;
  alias?: unknown;
  id?: unknown;
  spoilerFreeIntro?: unknown;
}

function buildKnownEntityList(store: CompanionBookStore): string {
  const entities = Object.values(store.entities);
  if (entities.length === 0) return "";
  const lines = [
    "Known entities — reuse the exact id when the text refers to one of these:",
  ];
  for (const e of entities.slice(0, 80)) {
    const also = e.aliases.length ? ` (also: ${e.aliases.slice(0, 4).join(", ")})` : "";
    lines.push(`  ${e.id}: ${e.name}${also} [${e.type}]`);
  }
  return lines.join("\n");
}

function parseEntities(raw: unknown): ChunkIndexResult["entities"] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : obj.entities ?? obj.characters ?? obj.people ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((x: unknown): x is RawEntity => typeof x === "object" && x !== null)
    .map((x) => ({
      name: typeof x.name === "string" ? x.name.trim() : "",
      type: x.type as EntityType,
      alias: typeof x.alias === "string" ? x.alias.trim() : undefined,
      id: typeof x.id === "string" ? x.id.trim() : undefined,
      spoilerFreeIntro:
        typeof x.spoilerFreeIntro === "string" ? x.spoilerFreeIntro.trim() : undefined,
    }))
    .filter(
      (x) =>
        x.name.length > 0 &&
        (x.type === "person" || x.type === "place" || x.type === "event")
    );
}

/**
 * Index one page chunk: extract entities + current-page summary + rolling story so far.
 */
export async function indexCompanionChunk(
  store: CompanionBookStore,
  text: string,
  chunkSeq: number
): Promise<ChunkIndexResult> {
  const known = buildKnownEntityList(store);
  const knownBlock = known ? `\n${known}\n` : "\n";
  const priorStory = store.storySoFar?.trim() || "(none yet — this is early in the reading session)";

  const response = await createFastChatCompletion({
    messages: [
      {
        role: "system",
        content: `You are a spoiler-safe personal reading companion for "${store.bookTitle}".
The user is reading elsewhere (e.g. Kindle). You only see the currently visible page text plus prior companion notes.
Do not invent plot beyond what is given. Keep spoilers out of intros and summaries.
${knownBlock}
Return a JSON object with:
- "entities": array of { "name", "type": "person"|"place"|"event", "alias"?: string, "id"?: string (required when matching known list), "spoilerFreeIntro"?: one short sentence for first appearance }
- "currentSummary": 1-2 sentences about what is happening on this page only
- "storySoFar": 2-4 sentences summarizing only what has been established so far (prior notes + this page). No future spoilers.`,
      },
      {
        role: "user",
        content: `Prior story-so-far notes:\n${priorStory}\n\nVisible page text (chunk ${chunkSeq}):\n\n${text.slice(0, 4000)}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 900,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    return {
      entities: [],
      currentSummary: "Could not summarize this page.",
      storySoFar: store.storySoFar || "Still gathering context from pages you’ve read.",
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entities = parseEntities(parsed);
    const currentSummary =
      typeof parsed.currentSummary === "string" && parsed.currentSummary.trim()
        ? parsed.currentSummary.trim()
        : "Page indexed.";
    const storySoFar =
      typeof parsed.storySoFar === "string" && parsed.storySoFar.trim()
        ? parsed.storySoFar.trim()
        : store.storySoFar || currentSummary;
    return { entities, currentSummary, storySoFar };
  } catch {
    return {
      entities: [],
      currentSummary: "Page indexed (summary parse failed).",
      storySoFar: store.storySoFar || "Still gathering context from pages you’ve read.",
    };
  }
}

/** Apply chunk index result onto the in-memory store (caller saves). */
export function applyChunkIndexResult(
  store: CompanionBookStore,
  result: ChunkIndexResult,
  chunkSeq: number
): void {
  for (const entity of result.entities) {
    mergeCompanionEntity(store, entity, chunkSeq);
  }
  store.storySoFar = result.storySoFar;
}
