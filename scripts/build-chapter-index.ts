#!/usr/bin/env bun
/**
 * Builds the cumulative chapter index: for each chapter, which persons, places,
 * and events are mentioned, and the first chapter each was seen in.
 * Run after parse-book. Chapter 1 gets a baseline introductory statement.
 * Loads .env so OPENAI_API_KEY is available for future LLM-powered indexing.
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { CHARACTERS } from "../lib/characters";
import { PLACES_AND_EVENTS } from "../lib/entities";

const DATA_DIR = join(import.meta.dir, "..", "data");
const BASELINE_INTRO =
  "The story opens in Marseilles. The following people, places, and events appear in this chapter.";

type EntityType = "person" | "place" | "event";

interface TermMatch {
  term: string;
  entityId: string;
  type: EntityType;
}

/** All search terms with entity id and type, sorted by term length descending (longest first) */
function buildTermList(): TermMatch[] {
  const list: TermMatch[] = [];
  for (const c of CHARACTERS) {
    const terms = [c.name, ...c.aliases, ...c.searchTerms];
    const seen = new Set<string>();
    for (const t of terms) {
      const key = t.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({ term: t, entityId: c.id, type: "person" });
    }
  }
  for (const e of PLACES_AND_EVENTS) {
    const terms = [e.name, ...e.searchTerms];
    const seen = new Set<string>();
    for (const t of terms) {
      const key = t.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push({ term: t, entityId: e.id, type: e.type });
    }
  }
  // Longest first so "Comte de Morcerf" wins over "Morcerf"
  list.sort((a, b) => b.term.length - a.term.length);
  return list;
}

/** Find all non-overlapping entity mentions in text (case-insensitive, longest match wins). Returns entity ids and the term that matched (for excerpt). */
function findMentions(
  content: string,
  termList: TermMatch[]
): Array<{ entityId: string; type: EntityType; matchedTerm: string }> {
  const lower = content.toLowerCase();
  const found = new Map<string, { entityId: string; type: EntityType; matchedTerm: string }>();
  const used: Array<[number, number]> = [];

  for (const { term, entityId, type } of termList) {
    const search = term.toLowerCase();
    let pos = 0;
    while (true) {
      const i = lower.indexOf(search, pos);
      if (i === -1) break;
      const end = i + search.length;
      const overlaps = used.some(([s, e]) => (i < e && end > s));
      if (!overlaps) {
        used.push([i, end]);
        found.set(entityId, { entityId, type, matchedTerm: term });
      }
      pos = end;
    }
  }

  return Array.from(found.values());
}

/** Optional: excerpt around a mention (for X-Ray "in this chapter" context) */
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

interface ChapterIndexEntity {
  entityId: string;
  type: EntityType;
  firstSeenInChapter: number;
  excerpt?: string;
}

interface ChapterIndexEntry {
  number: number;
  baselineIntro?: string;
  entities: ChapterIndexEntity[];
}

interface ChapterIndex {
  chapters: ChapterIndexEntry[];
}

async function main() {
  const bookPath = join(DATA_DIR, "book.json");
  const book = JSON.parse(readFileSync(bookPath, "utf-8")) as {
    chapters: Array<{ number: number; content: string }>;
  };

  const termList = buildTermList();
  const firstSeen = new Map<string, number>(); // entityId -> first chapter number
  const index: ChapterIndex = { chapters: [] };

  for (const chapter of book.chapters) {
    const mentions = findMentions(chapter.content, termList);
    const entities: ChapterIndexEntity[] = [];

    for (const { entityId, type, matchedTerm } of mentions) {
      const prev = firstSeen.get(entityId);
      const firstChapter = prev ?? chapter.number;
      if (!prev) firstSeen.set(entityId, chapter.number);

      const excerpt =
        chapter.content.length < 5000 ? getExcerpt(chapter.content, matchedTerm) : undefined;

      entities.push({
        entityId,
        type,
        firstSeenInChapter: firstChapter,
        ...(excerpt ? { excerpt } : {}),
      });
    }

    index.chapters.push({
      number: chapter.number,
      ...(chapter.number === 1 ? { baselineIntro: BASELINE_INTRO } : {}),
      entities,
    });
  }

  const outPath = join(DATA_DIR, "chapter-index.json");
  writeFileSync(outPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${outPath} (${index.chapters.length} chapters).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
