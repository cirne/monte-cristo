#!/usr/bin/env bun
/**
 * Index a chapter (or all chapters) with LLM: find people/places/events,
 * generate content, and update the entity store when entities were referenced
 * in earlier chapters.
 *
 * Prereqs: parse-book (data/book.json). Optional: seed entity store from
 * known entities from the store so the LLM reuses IDs.
 *
 * Usage:
 *   bun run scripts/index-chapter.ts --book=monte-cristo --chapter=1
 *   bun run scripts/index-chapter.ts --book=monte-cristo --all
 *   bun run scripts/index-chapter.ts --book=gatsby --all
 *   bun run scripts/index-chapter.ts --book=monte-cristo --all
 *   bun run scripts/index-chapter.ts --book=monte-cristo --chapter=6 --overwrite-existing
 *   bun run scripts/index-chapter.ts --book=monte-cristo --all --with-summaries
 *   bun run scripts/index-chapter.ts --book=monte-cristo --chapter=6 --summaries-only
 *   bun run scripts/index-chapter.ts --book=gatsby --chapter=1 --workers=32
 *
 * Writes are guarded by a filesystem lock (data/<book>/.index.lock); concurrent runs
 * serialize on the lock and merge their results, so parallel indexing is safe.
 *
 * Scenes are detected via LLM and written into each chapter index entry (data/chapter-index.json).
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as lockfile from "proper-lockfile";
import type { LockOptions } from "proper-lockfile";
import { createChatCompletion } from "../lib/llm";
import type { ChapterIndex, ChapterIndexEntry, EntityType } from "../lib/chapter-index";
import {
  type EntityStoreData,
  type StoredEntity,
  slugifyEntityName,
  normalizeNameForMatch,
} from "../lib/entity-store";
import { getSingleScene, getParagraphs, normalizeScenes, type SceneWithDetails } from "../lib/scenes";
import { getScenesFromLLM } from "../lib/scenes-llm";
import { mergeChapterIndexEntry, mergeChapterScenes } from "../lib/chapter-index-merge";
import { mergeEntityStoreInto, mergeChapterIndexInto } from "../lib/index-write-merge";
import { getBookConfig, isBookSlug } from "../lib/books";

const ROOT_DATA_DIR = join(import.meta.dir, "..", "data");
const DEFAULT_BASELINE_INTRO =
  "The following people, places, and events appear in this chapter.";

const LOCK_STALE_MS = 60_000;
const LOCK_RETRIES = { retries: 30, factor: 1.5, minTimeout: 1000, maxTimeout: 15_000 };

/** Options for proper-lockfile when guarding the book index/store. Single place to tune timeouts and paths. */
function getLockOptions(dataDir: string): LockOptions {
  return {
    stale: LOCK_STALE_MS,
    retries: LOCK_RETRIES,
    lockfilePath: join(dataDir, ".index.lock"),
    realpath: false,
    onCompromised: (err) => {
      console.error("Index lock compromised:", err);
      throw err;
    },
  };
}

/** Acquire lock on dataDir, run fn, release in finally. Manages mkdir, lock, and release. */
async function withIndexLock<T>(dataDir: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(dataDir, { recursive: true });
  const release = await lockfile.lock(dataDir, getLockOptions(dataDir));
  try {
    return await fn();
  } finally {
    await release();
  }
}

const MAX_CHAPTER_CONTENT_CHARS = 60_000;
const MAX_SUMMARY_SOURCE_CHARS = 55_000;
const MAX_SCENE_SUMMARY_CHARS = 8_000;

/** Excerpt around first occurrence of a term in content */
function getExcerpt(content: string, term: string, maxLen = 240): string {
  const lower = content.toLowerCase();
  const search = term.toLowerCase();
  const i = lower.indexOf(search);
  if (i === -1) return "";
  const start = Math.max(0, i - 80);
  const end = Math.min(content.length, i + term.length + 160);
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
  /** When the entity is one of our canonical entities, use this exact id so links work */
  id?: string;
}

/** Build "known entities" list for the LLM from the current entity store so it reuses IDs. */
function buildKnownEntityListForPrompt(store: EntityStoreData): string {
  const persons = Object.values(store.entities).filter((e) => e.type === "person");
  const placesAndEvents = Object.values(store.entities).filter(
    (e) => e.type === "place" || e.type === "event"
  );
  if (persons.length === 0 && placesAndEvents.length === 0) return "";
  const lines: string[] = [];
  lines.push(
    "Known entities — when the text refers to someone/something in this list, use its exact 'id' so links stay consistent. For new entities omit 'id' and we will assign one."
  );
  if (persons.length > 0) {
    lines.push("Persons:");
    for (const c of persons) {
      const terms = [c.name, ...c.aliases, ...c.searchTerms].filter(Boolean).slice(0, 6);
      const also = terms.length > 1 ? ` (also: ${terms.slice(1).join(", ")})` : "";
      lines.push(`  ${c.id}: ${c.name}${also}`);
    }
  }
  if (placesAndEvents.length > 0) {
    lines.push("Places and events:");
    for (const e of placesAndEvents) {
      const terms = [e.name, ...e.searchTerms].filter(Boolean).slice(0, 5);
      const also = terms.length > 1 ? ` (also: ${terms.slice(1).join(", ")})` : "";
      lines.push(`  ${e.id}: ${e.name}${also}`);
    }
  }
  return lines.join("\n");
}

/** Call LLM to extract people, places, and events from chapter text. Pass current store so LLM reuses known IDs.
 * Returns all entities mentioned in the chapter (new and existing). */
async function extractEntities(
  chapterNumber: number,
  content: string,
  bookTitle: string,
  store: EntityStoreData
): Promise<ExtractedEntity[]> {
  const text = content.slice(0, MAX_CHAPTER_CONTENT_CHARS);
  if (content.length > MAX_CHAPTER_CONTENT_CHARS) {
    console.warn(`Chapter ${chapterNumber} truncated to ${MAX_CHAPTER_CONTENT_CHARS} chars for extraction.`);
  }

  const knownList = buildKnownEntityListForPrompt(store);
  const knownBlock = knownList
    ? `\n${knownList}\n`
    : "\n";

  const MIN_CONTENT_FOR_RETRY = 2000;
  let lastList: ExtractedEntity[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: `You extract people, places, and events from a chapter of "${bookTitle}".${knownBlock}

Return a JSON object with a key "entities" whose value is an array of objects. Each object has:
- "name": canonical full name (use the name from the list above when you use an id)
- "type": "person" | "place" | "event"
- "alias": optional string, how they are referred to in this chapter if different from name
- "id": optional string, REQUIRED when the entity is in the known list above — use the exact id from that list

Include every named person, place, or significant event mentioned in the chapter — both new entities and those already in the known list. The chapter index needs a complete list of all entities mentioned in this chapter. Use consistent canonical names.`,
        },
        {
          role: "user",
          content: `Chapter ${chapterNumber}:\n\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as
        | { entities?: ExtractedEntity[] }
        | { characters?: ExtractedEntity[] }
        | { people?: ExtractedEntity[] }
        | { items?: ExtractedEntity[] }
        | ExtractedEntity[];
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as Record<string, unknown>).entities ??
          (parsed as Record<string, unknown>).characters ??
          (parsed as Record<string, unknown>).people ??
          (parsed as Record<string, unknown>).items ??
          [];
      lastList = (Array.isArray(list) ? list : []).filter(
        (x: unknown): x is ExtractedEntity =>
          typeof x === "object" &&
          x !== null &&
          "name" in x &&
          typeof (x as ExtractedEntity).name === "string" &&
          ["person", "place", "event"].includes((x as ExtractedEntity).type)
      );
      if (lastList.length > 0) return lastList;
      if (text.length >= MIN_CONTENT_FOR_RETRY && attempt === 0) {
        console.warn(`Chapter ${chapterNumber}: extraction returned 0 entities, retrying once...`);
      }
    } catch {
      // continue to retry
    }
  }

  if (lastList.length === 0 && text.length >= MIN_CONTENT_FOR_RETRY) {
    console.warn(`Chapter ${chapterNumber}: extraction still empty after retry (chapter has ${text.length} chars).`);
  }
  return lastList;
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

function normalizeSingleParagraphSummary(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 24) return undefined;
  return text;
}

function parseSummaryFieldFromRaw(
  raw: string | undefined,
  preferredKeys: string[]
): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of preferredKeys) {
      const value = parsed[key];
      if (typeof value === "string") {
        const normalized = normalizeSingleParagraphSummary(value);
        if (normalized) return normalized;
      }
    }
  } catch {
    const normalized = normalizeSingleParagraphSummary(trimmed);
    if (normalized) return normalized;
  }
  return undefined;
}

async function summarizeChapter(
  chapterNumber: number,
  content: string,
  bookTitle: string
): Promise<string | undefined> {
  const source = content.slice(0, MAX_SUMMARY_SOURCE_CHARS);
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You summarize one chapter of "${bookTitle}" for a reader.
Return strict JSON with one key "summary".
The summary must be exactly one paragraph, spoiler-safe relative to the chapter text provided, and written in clear modern prose.`,
      },
      {
        role: "user",
        content: `Chapter ${chapterNumber} text:\n\n${source}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 220,
  });

  return parseSummaryFieldFromRaw(response.choices[0]?.message?.content, ["summary"]);
}

async function summarizeScene(
  chapterNumber: number,
  sceneIndex: number,
  sceneText: string,
  bookTitle: string
): Promise<string | undefined> {
  const source = sceneText.slice(0, MAX_SCENE_SUMMARY_CHARS);
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You summarize one scene from "${bookTitle}".
Return strict JSON with one key "summary".
Output one concise paragraph (2-4 sentences), grounded only in the provided excerpt and without future spoilers.`,
      },
      {
        role: "user",
        content: `Chapter ${chapterNumber}, scene ${sceneIndex + 1} excerpt:\n\n${source}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 160,
  });
  return parseSummaryFieldFromRaw(response.choices[0]?.message?.content, ["summary"]);
}

async function summarizeStorySoFar(
  chapterNumber: number,
  previousStorySoFar: string | undefined,
  chapterSummary: string
): Promise<string | undefined> {
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You maintain a rolling "story so far" summary for a serialized novel.
Return strict JSON with one key "summary".
Output one paragraph that captures the major threads through the current chapter, without adding details not present in context.`,
      },
      {
        role: "user",
        content: `Previous rolling summary (through chapter ${chapterNumber - 1}):
${previousStorySoFar ?? "(none)"}

Current chapter summary (chapter ${chapterNumber}):
${chapterSummary}

Produce the updated rolling summary through chapter ${chapterNumber}.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 260,
  });
  return parseSummaryFieldFromRaw(response.choices[0]?.message?.content, ["summary"]);
}

interface SummaryBuildResult {
  chapterSummary?: string;
  storySoFarSummary?: string;
  scenes?: SceneWithDetails[];
}

function getSceneTextByRange(
  paragraphs: string[],
  startParagraph: number,
  endParagraph: number
): string {
  return paragraphs.slice(startParagraph, endParagraph + 1).join("\n\n");
}

function getPreviousStorySummaryForChapter(
  index: ChapterIndex,
  chapterNumber: number
): string | undefined {
  if (chapterNumber <= 1) return undefined;
  const byNumber = new Map(index.chapters.map((entry) => [entry.number, entry]));
  const previous = byNumber.get(chapterNumber - 1);
  const rolling = previous?.storySoFarSummary?.trim();
  if (rolling) return rolling;

  const lines: string[] = [];
  const start = Math.max(1, chapterNumber - 6);
  for (let n = start; n <= chapterNumber - 1; n++) {
    const chapterSummary = byNumber.get(n)?.chapterSummary?.trim();
    if (!chapterSummary) continue;
    lines.push(`Chapter ${n}: ${chapterSummary}`);
  }
  return lines.length > 0 ? lines.join("\n") : undefined;
}

async function buildChapterSummaries(params: {
  chapterNumber: number;
  content: string;
  scenes: SceneWithDetails[] | undefined;
  previousStorySoFar: string | undefined;
  bookTitle: string;
}): Promise<SummaryBuildResult> {
  const { chapterNumber, content, scenes, previousStorySoFar, bookTitle } = params;
  const paragraphs = getParagraphs(content);
  const normalizedScenes = normalizeScenes(scenes, paragraphs.length);
  const scenesWithSummary = normalizedScenes.map((scene) => ({ ...scene }));

  const chapterSummary = await summarizeChapter(chapterNumber, content, bookTitle);

  for (let i = 0; i < scenesWithSummary.length; i++) {
    const scene = scenesWithSummary[i];
    if (scene.summary?.trim()) continue;
    const sceneText = getSceneTextByRange(paragraphs, scene.startParagraph, scene.endParagraph);
    if (!sceneText.trim()) continue;
    try {
      const summary = await summarizeScene(chapterNumber, i, sceneText, bookTitle);
      if (summary) scenesWithSummary[i].summary = summary;
    } catch (e) {
      console.warn(`Skipping scene summary for chapter ${chapterNumber}, scene ${i}:`, e);
    }
  }

  let storySoFarSummary: string | undefined;
  if (chapterSummary) {
    try {
      storySoFarSummary = await summarizeStorySoFar(chapterNumber, previousStorySoFar, chapterSummary);
    } catch (e) {
      console.warn(`Skipping rolling story summary for chapter ${chapterNumber}:`, e);
    }
  }

  return {
    chapterSummary,
    storySoFarSummary,
    scenes: scenesWithSummary.length > 0 ? scenesWithSummary : undefined,
  };
}

function applySummaryBuildResult(
  entry: ChapterIndexEntry,
  summary: SummaryBuildResult,
  overwriteExisting: boolean
): ChapterIndexEntry {
  const next: ChapterIndexEntry = {
    ...entry,
    entities: entry.entities.map((entity) => ({ ...entity })),
    scenes: entry.scenes?.map((scene) => ({
      ...scene,
      ...(scene.characterIds ? { characterIds: [...scene.characterIds] } : {}),
    })),
  };

  if (summary.chapterSummary) {
    if (overwriteExisting || !next.chapterSummary?.trim()) {
      next.chapterSummary = summary.chapterSummary;
    }
  }

  if (summary.storySoFarSummary) {
    if (overwriteExisting || !next.storySoFarSummary?.trim()) {
      next.storySoFarSummary = summary.storySoFarSummary;
    }
  }

  if (summary.scenes?.length) {
    if (overwriteExisting) {
      next.scenes = summary.scenes.map((scene) => ({
        ...scene,
        ...(scene.characterIds ? { characterIds: [...scene.characterIds] } : {}),
      }));
    } else {
      next.scenes = mergeChapterScenes(next.scenes, summary.scenes);
    }
  }

  return next;
}

/** Index a single chapter: extract entities, merge into store, build index entry with scenes */
async function indexChapter(
  chapterNumber: number,
  content: string,
  store: EntityStoreData,
  opts: { bookTitle: string; baselineIntro: string; bookSlug: string; workers: number; imageStyleHint?: string }
): Promise<ChapterIndexEntry> {
  const { bookTitle, baselineIntro, workers, imageStyleHint } = opts;
  const extracted = await extractEntities(chapterNumber, content, bookTitle, store);

  const entryEntities: ChapterIndexEntry["entities"] = [];
  const firstSeenUpdates = new Map<string, number>();
  const introTasks: { stored: StoredEntity; ex: ExtractedEntity; excerpt: string }[] = [];

  for (const ex of extracted) {
    let entityId: string;
    let firstSeenInChapter: number;

    const existingById = ex.id ? store.entities[ex.id] : undefined;
    const existingByName = findExistingEntity(store, ex.name, ex.type);

    if (existingById) {
      entityId = ex.id!;
      firstSeenInChapter = Math.min(existingById.firstSeenInChapter, chapterNumber);
      firstSeenUpdates.set(entityId, firstSeenInChapter);
      if (ex.alias?.trim() && !existingById.aliases.includes(ex.alias.trim())) {
        existingById.aliases = [...new Set([...existingById.aliases, ex.alias.trim()])];
        existingById.searchTerms = [...new Set([...existingById.searchTerms, ex.alias.trim()])];
      }
    } else if (existingByName) {
      entityId = existingByName.id;
      firstSeenInChapter = Math.min(existingByName.firstSeenInChapter, chapterNumber);
      firstSeenUpdates.set(entityId, firstSeenInChapter);
      if (ex.alias?.trim() && !existingByName.aliases.includes(ex.alias.trim())) {
        existingByName.aliases = [...new Set([...existingByName.aliases, ex.alias.trim()])];
        existingByName.searchTerms = [...new Set([...existingByName.searchTerms, ex.alias.trim()])];
      }
    } else {
      entityId = ex.id && !store.entities[ex.id] ? ex.id : slugifyEntityName(ex.name);
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
      introTasks.push({ stored, ex, excerpt });
    }

    entryEntities.push({
      entityId,
      type: ex.type,
      firstSeenInChapter: firstSeenInChapter,
      ...(excerpt ? { excerpt } : {}),
    });
  }

  // Generate spoiler-free intros in parallel (up to workers at a time)
  for (let i = 0; i < introTasks.length; i += workers) {
    const chunk = introTasks.slice(i, i + workers);
    await Promise.all(
      chunk.map(async ({ stored, ex, excerpt }) => {
        try {
          const intro = await generateSpoilerFreeIntro(ex.name, ex.type, chapterNumber, excerpt);
          if (intro) stored.spoilerFreeIntro = intro;
        } catch (e) {
          console.warn("Skipping intro gen for", ex.name, e);
        }
      })
    );
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
    scenes = await getScenesFromLLM(chapterNumber, content, entityRefs, {
      bookTitle,
      imageStyleHint,
    });
  } catch (e) {
    console.warn("LLM scene delineation failed, using single scene for chapter:", (e as Error).message);
    const single = getSingleScene(content);
    scenes = single.length > 0 ? single : undefined;
  }

  return {
    number: chapterNumber,
    ...(chapterNumber === 1 ? { baselineIntro } : {}),
    entities: entryEntities,
    scenes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const bookArg = args.find((a) => a.startsWith("--book="));
  const bookSlug = bookArg ? bookArg.split("=")[1]?.trim() : "monte-cristo";
  if (!bookSlug || !isBookSlug(bookSlug)) {
    console.error(
      `Invalid or missing --book=. Use --book=monte-cristo or --book=gatsby (e.g. bun run scripts/index-chapter.ts --book=monte-cristo --all)`
    );
    process.exit(1);
  }

  const DATA_DIR = join(ROOT_DATA_DIR, bookSlug);
  const config = getBookConfig(bookSlug)!;
  const bookTitle = config.title;
  const baselineIntro = config.baselineIntro ?? DEFAULT_BASELINE_INTRO;

  const chapterArg = args.find((a) => a.startsWith("--chapter="));
  const chapterNum = chapterArg ? parseInt(chapterArg.split("=")[1], 10) : null;
  const all = args.includes("--all");
  const overwriteExisting = args.includes("--overwrite-existing") || args.includes("--overwrite");
  const withSummaries = args.includes("--with-summaries") || args.includes("--summaries");
  const summariesOnly = args.includes("--summaries-only");
  const workersArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const workers = workersArg ? Math.max(1, parseInt(workersArg, 10)) : 4;

  if (!all && (chapterNum == null || isNaN(chapterNum))) {
    console.error(
      "Usage: bun run scripts/index-chapter.ts --book=<slug> --chapter=1 | --all [--overwrite-existing] [--with-summaries | --summaries-only] [--workers=N]"
    );
    process.exit(1);
  }

  if (!overwriteExisting) {
    console.log("Patch mode: preserving existing chapter data (use --overwrite-existing to replace).");
  }
  if (withSummaries || summariesOnly) {
    console.log("Summary generation enabled.");
  }
  if (summariesOnly) {
    console.log("Summaries-only mode: preserving existing entity and scene metadata.");
  }
  if (workers !== 4) {
    console.log(`Using ${workers} workers for parallel intro generation.`);
  }

  const bookPath = join(DATA_DIR, "book.json");
  if (!existsSync(bookPath)) {
    console.error(`Run the book parser first to create data/${bookSlug}/book.json`);
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

  const indexPath = join(DATA_DIR, "chapter-index.json");
  let index: ChapterIndex = { chapters: [] };
  if (existsSync(indexPath)) {
    index = JSON.parse(readFileSync(indexPath, "utf-8")) as ChapterIndex;
  }

  const toProcess = (all
    ? book.chapters
    : book.chapters.filter((c) => c.number === chapterNum)
  ).sort((a, b) => a.number - b.number);

  if (toProcess.length === 0) {
    console.error("No chapter to process.");
    process.exit(1);
  }

  for (const ch of toProcess) {
    const modeLabel = summariesOnly ? "Summarizing" : "Indexing";
    console.log(`${modeLabel} chapter ${ch.number}...`);
    const existingIdx = index.chapters.findIndex((c) => c.number === ch.number);
    const existingEntry = existingIdx >= 0 ? index.chapters[existingIdx] : undefined;

    const indexedEntry = summariesOnly
      ? ({
          number: ch.number,
          ...(ch.number === 1 ? { baselineIntro } : {}),
          entities: existingEntry?.entities ?? [],
          scenes: existingEntry?.scenes ?? (getSingleScene(ch.content).length > 0 ? getSingleScene(ch.content) : []),
          ...(existingEntry?.chapterSummary ? { chapterSummary: existingEntry.chapterSummary } : {}),
          ...(existingEntry?.storySoFarSummary ? { storySoFarSummary: existingEntry.storySoFarSummary } : {}),
        } satisfies ChapterIndexEntry)
      : await indexChapter(ch.number, ch.content, store, {
          bookTitle,
          baselineIntro,
          bookSlug,
          workers,
          imageStyleHint: config.imageStyleHint,
        });

    let mergedEntry = mergeChapterIndexEntry(existingEntry, indexedEntry, { overwriteExisting });

    if (withSummaries || summariesOnly) {
      const previousStorySoFar = getPreviousStorySummaryForChapter(index, ch.number);
      const summaryBuild = await buildChapterSummaries({
        chapterNumber: ch.number,
        content: ch.content,
        scenes: mergedEntry.scenes,
        previousStorySoFar,
        bookTitle,
      });
      mergedEntry = applySummaryBuildResult(mergedEntry, summaryBuild, overwriteExisting);
    }

    if (existingIdx >= 0) index.chapters[existingIdx] = mergedEntry;
    else index.chapters.push(mergedEntry);
    index.chapters.sort((a, b) => a.number - b.number);
  }

  store.lastIndexedChapter = Math.max(
    ...index.chapters.map((c) => c.number),
    store.lastIndexedChapter ?? 0
  );

  await withIndexLock(DATA_DIR, async () => {
    let reReadStore: EntityStoreData = { entities: {} };
    if (existsSync(storePath)) {
      reReadStore = JSON.parse(readFileSync(storePath, "utf-8")) as EntityStoreData;
    }
    let reReadIndex: ChapterIndex = { chapters: [] };
    if (existsSync(indexPath)) {
      reReadIndex = JSON.parse(readFileSync(indexPath, "utf-8")) as ChapterIndex;
    }
    const mergedStore = mergeEntityStoreInto(reReadStore, store);
    const mergedIndex = mergeChapterIndexInto(reReadIndex, index, toProcess);
    writeFileSync(storePath, JSON.stringify(mergedStore, null, 2));
    writeFileSync(indexPath, JSON.stringify(mergedIndex, null, 2));
    console.log(`Wrote ${storePath} (${Object.keys(mergedStore.entities).length} entities).`);
    console.log(`Wrote ${indexPath} (${mergedIndex.chapters.length} chapters).`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
