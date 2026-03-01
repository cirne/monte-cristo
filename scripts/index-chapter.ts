#!/usr/bin/env bun
/**
 * Index a chapter (or all chapters) with LLM: find people/places/events,
 * generate content, and update the entity store when entities were referenced
 * in earlier chapters.
 *
 * Prereqs: parse-book (data/book.json). Optional: seed entity store from
 * curated characters/entities so existing IDs stay stable.
 *
 * Usage:
 *   bun run scripts/index-chapter.ts --chapter=1
 *   bun run scripts/index-chapter.ts --all
 *   bun run scripts/index-chapter.ts --all --seed-from-curated
 *
 * Scenes are detected via LLM and written into each chapter index entry (data/chapter-index.json).
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createChatCompletion } from "../lib/llm";
import type { ChapterIndex, ChapterIndexEntry, EntityType } from "../lib/chapter-index";
import {
  type EntityStoreData,
  type StoredEntity,
  slugifyEntityName,
  normalizeNameForMatch,
} from "../lib/entity-store";
import { getSingleScene } from "../lib/scenes";
import { getScenesFromLLM } from "../lib/scenes-llm";
import { CHARACTERS } from "../lib/characters";
import { PLACES_AND_EVENTS } from "../lib/entities";

const DATA_DIR = join(import.meta.dir, "..", "data");
const BASELINE_INTRO =
  "The story opens in Marseilles. The following people, places, and events appear in this chapter.";

const MAX_CHAPTER_CONTENT_CHARS = 60_000;

/** Excerpt around first occurrence of a term in content */
function getExcerpt(content: string, term: string, maxLen = 120): string {
  const lower = content.toLowerCase();
  const search = term.toLowerCase();
  const i = lower.indexOf(search);
  if (i === -1) return "";
  const start = Math.max(0, i - 40);
  const end = Math.min(content.length, i + term.length + 80);
  let excerpt = content.slice(start, end).replace(/\n/g, " ").trim();
  if (excerpt.length > maxLen) {
    excerpt = (start > 0 ? "…" : "") + excerpt.slice(0, maxLen - 1) + "…";
  }
  return excerpt;
}

/** Find which search term appears first in content (case-insensitive); return that term */
function getFirstMatchingTerm(content: string, terms: string[]): string | null {
  const lower = content.toLowerCase();
  let firstIndex = Infinity;
  let firstTerm: string | null = null;
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase());
    if (i !== -1 && i < firstIndex) {
      firstIndex = i;
      firstTerm = t;
    }
  }
  return firstTerm;
}

/** Seed entity store from curated characters and places/events */
function seedStoreFromCurated(store: EntityStoreData): void {
  for (const c of CHARACTERS) {
    const id = c.id;
    if (store.entities[id]) continue;
    store.entities[id] = {
      id,
      name: c.name,
      aliases: c.aliases,
      type: "person",
      firstSeenInChapter: 9999,
      spoilerFreeIntro: c.spoilerFreeIntro,
      searchTerms: [c.name, ...c.aliases, ...c.searchTerms],
    };
  }
  for (const e of PLACES_AND_EVENTS) {
    const id = e.id;
    if (store.entities[id]) continue;
    store.entities[id] = {
      id,
      name: e.name,
      aliases: [],
      type: e.type,
      firstSeenInChapter: 9999,
      spoilerFreeIntro: e.spoilerFreeIntro,
      searchTerms: [e.name, ...e.searchTerms],
    };
  }
}

/** Resolve extracted name to existing store entity by normalized name match */
function findExistingEntity(
  store: EntityStoreData,
  name: string,
  type: EntityType
): StoredEntity | undefined {
  const norm = normalizeNameForMatch(name);
  for (const e of Object.values(store.entities)) {
    if (e.type !== type) continue;
    if (normalizeNameForMatch(e.name) === norm) return e;
    if (e.aliases.some((a) => normalizeNameForMatch(a) === norm)) return e;
  }
  return undefined;
}

/** LLM-extracted entity from chapter text */
interface ExtractedEntity {
  name: string;
  type: EntityType;
  /** Optional alias or how they're referred to in this chapter */
  alias?: string;
}

/** Call LLM to extract people, places, and events from chapter text */
async function extractEntities(
  chapterNumber: number,
  content: string
): Promise<ExtractedEntity[]> {
  const text = content.slice(0, MAX_CHAPTER_CONTENT_CHARS);
  if (content.length > MAX_CHAPTER_CONTENT_CHARS) {
    console.warn(`Chapter ${chapterNumber} truncated to ${MAX_CHAPTER_CONTENT_CHARS} chars for extraction.`);
  }

  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You extract people, places, and events from a chapter of "The Count of Monte Cristo".
Return a JSON array of objects. Each object has:
- "name": canonical full name (e.g. "Edmond Dantès", "Château d'If")
- "type": "person" | "place" | "event"
- "alias": optional string, how they are referred to in this chapter if different from name
Include every named person, place, or significant event mentioned. Use consistent canonical names.`,
      },
      {
        role: "user",
        content: `Chapter ${chapterNumber}:\n\n${text}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as
      | { entities?: ExtractedEntity[] }
      | ExtractedEntity[];
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed.entities ?? []);
    return list.filter(
      (x: unknown): x is ExtractedEntity =>
        typeof x === "object" &&
        x !== null &&
        "name" in x &&
        typeof (x as ExtractedEntity).name === "string" &&
        ["person", "place", "event"].includes((x as ExtractedEntity).type)
    );
  } catch {
    return [];
  }
}

/** Generate spoiler-free intro for an entity on first appearance (optional LLM) */
async function generateSpoilerFreeIntro(
  entityName: string,
  entityType: EntityType,
  chapterNumber: number,
  excerpt: string
): Promise<string | undefined> {
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `Write one short sentence (spoiler-free) introducing this ${entityType} for a reader at their first appearance in the novel. No plot spoilers. Example: "A young sailor, first mate of the Pharaon."`,
      },
      {
        role: "user",
        content: `${entityName}. Context from chapter ${chapterNumber}: "${excerpt}"`,
      },
    ],
    max_tokens: 80,
  });

  const line = response.choices[0]?.message?.content?.trim();
  return line && line.length < 200 ? line : undefined;
}

/** Index a single chapter: extract entities, merge into store, build index entry with scenes */
async function indexChapter(
  chapterNumber: number,
  content: string,
  store: EntityStoreData,
  index: ChapterIndex
): Promise<ChapterIndexEntry> {
  const extracted = await extractEntities(chapterNumber, content);

  const entryEntities: ChapterIndexEntry["entities"] = [];
  const firstSeenUpdates = new Map<string, number>();

  for (const ex of extracted) {
    const existing = findExistingEntity(store, ex.name, ex.type);
    let entityId: string;
    let firstSeenInChapter: number;

    if (existing) {
      entityId = existing.id;
      firstSeenInChapter = Math.min(existing.firstSeenInChapter, chapterNumber);
      firstSeenUpdates.set(entityId, firstSeenInChapter);
      if (ex.alias && ex.alias.trim() && !existing.aliases.includes(ex.alias.trim())) {
        existing.aliases = [...new Set([...existing.aliases, ex.alias.trim()])];
        existing.searchTerms = [...new Set([...existing.searchTerms, ex.alias.trim()])];
      }
    } else {
      entityId = slugifyEntityName(ex.name);
      if (store.entities[entityId]) {
        let suffix = 1;
        while (store.entities[entityId + "_" + suffix]) suffix++;
        entityId = entityId + "_" + suffix;
      }
      firstSeenInChapter = chapterNumber;
      const searchTerms = [ex.name];
      if (ex.alias?.trim()) searchTerms.push(ex.alias.trim());
      store.entities[entityId] = {
        id: entityId,
        name: ex.name,
        aliases: ex.alias?.trim() ? [ex.alias.trim()] : [],
        type: ex.type,
        firstSeenInChapter,
        searchTerms: [...new Set(searchTerms)],
      };
    }

    const stored = store.entities[entityId];
    const term = getFirstMatchingTerm(content, stored.searchTerms);
    const excerpt = term ? getExcerpt(content, term) : undefined;

    if (firstSeenInChapter === chapterNumber && excerpt && !stored.spoilerFreeIntro) {
      try {
        const intro = await generateSpoilerFreeIntro(ex.name, ex.type, chapterNumber, excerpt);
        if (intro) stored.spoilerFreeIntro = intro;
      } catch (e) {
        console.warn("Skipping intro gen for", ex.name, e);
      }
    }

    entryEntities.push({
      entityId,
      type: ex.type,
      firstSeenInChapter: firstSeenInChapter,
      ...(excerpt ? { excerpt } : {}),
    });
  }

  for (const [id, first] of firstSeenUpdates) {
    const e = store.entities[id];
    if (e && e.firstSeenInChapter > first) e.firstSeenInChapter = first;
  }

  let scenes: ChapterIndexEntry["scenes"];

  try {
    const entityRefs = entryEntities.map((e) => ({
      id: e.entityId,
      name: store.entities[e.entityId]?.name ?? e.entityId,
      type: e.type,
    }));
    scenes = await getScenesFromLLM(chapterNumber, content, entityRefs);
  } catch (e) {
    console.warn("LLM scene delineation failed, using single scene for chapter:", (e as Error).message);
    const single = getSingleScene(content);
    scenes = single.length > 0 ? single : undefined;
  }

  return {
    number: chapterNumber,
    ...(chapterNumber === 1 ? { baselineIntro: BASELINE_INTRO } : {}),
    entities: entryEntities,
    scenes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const chapterArg = args.find((a) => a.startsWith("--chapter="));
  const chapterNum = chapterArg ? parseInt(chapterArg.split("=")[1], 10) : null;
  const all = args.includes("--all");
  const seedFromCurated = args.includes("--seed-from-curated");

  if (!all && (chapterNum == null || isNaN(chapterNum))) {
    console.error("Usage: bun run scripts/index-chapter.ts --chapter=1 | --all [--seed-from-curated]");
    process.exit(1);
  }

  const bookPath = join(DATA_DIR, "book.json");
  if (!existsSync(bookPath)) {
    console.error("Run parse-book first to create data/book.json");
    process.exit(1);
  }

  const book = JSON.parse(readFileSync(bookPath, "utf-8")) as {
    chapters: Array<{ number: number; content: string }>;
  };

  const storePath = join(DATA_DIR, "entity-store.json");
  let store: EntityStoreData = { entities: {} };
  if (existsSync(storePath)) {
    store = JSON.parse(readFileSync(storePath, "utf-8")) as EntityStoreData;
  }
  if (seedFromCurated) {
    seedStoreFromCurated(store);
    console.log("Seeded entity store from curated characters and places/events.");
  }

  const indexPath = join(DATA_DIR, "chapter-index.json");
  let index: ChapterIndex = { chapters: [] };
  if (existsSync(indexPath)) {
    index = JSON.parse(readFileSync(indexPath, "utf-8")) as ChapterIndex;
  }

  const toProcess = all
    ? book.chapters
    : book.chapters.filter((c) => c.number === chapterNum);

  if (toProcess.length === 0) {
    console.error("No chapter to process.");
    process.exit(1);
  }

  for (const ch of toProcess) {
    console.log(`Indexing chapter ${ch.number}...`);
    const entry = await indexChapter(ch.number, ch.content, store, index);
    const existingIdx = index.chapters.findIndex((c) => c.number === ch.number);
    if (existingIdx >= 0) index.chapters[existingIdx] = entry;
    else index.chapters.push(entry);
    index.chapters.sort((a, b) => a.number - b.number);
  }

  store.lastIndexedChapter = Math.max(
    ...index.chapters.map((c) => c.number),
    store.lastIndexedChapter ?? 0
  );

  writeFileSync(storePath, JSON.stringify(store, null, 2));
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${storePath} (${Object.keys(store.entities).length} entities).`);
  console.log(`Wrote ${indexPath} (${index.chapters.length} chapters).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
