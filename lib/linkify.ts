/**
 * Turns paragraph text into segments (plain text and entity links) for the chapter page.
 * Only links entities that appear in the chapter index for the given chapter.
 * Longest match wins to avoid overlapping links (e.g. "Comte de Morcerf" over "Morcerf").
 */

import { getCharacter } from "./characters";
import { getPlaceOrEvent } from "./entities";
import { getChapterIndexEntry } from "./chapter-index";
import type { EntityType } from "./chapter-index";

export interface LinkSegment {
  type: "link";
  content: string;
  entityId: string;
  entityType: EntityType;
}

export interface TextSegment {
  type: "text";
  content: string;
}

export type Segment = TextSegment | LinkSegment;

interface TermInfo {
  term: string;
  entityId: string;
  entityType: EntityType;
}

/** Build term list for entities that appear in this chapter (longest first) */
function getTermsForChapter(chapterNumber: number): TermInfo[] {
  const entry = getChapterIndexEntry(chapterNumber);
  if (!entry) return [];

  const terms: TermInfo[] = [];
  const seen = new Set<string>();

  for (const { entityId, type } of entry.entities) {
    if (type === "person") {
      const c = getCharacter(entityId);
      if (!c) continue;
      const toAdd = [c.name, ...c.aliases, ...c.searchTerms];
      for (const t of toAdd) {
        const key = t.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        terms.push({ term: t, entityId, entityType: "person" });
      }
    } else {
      const e = getPlaceOrEvent(entityId);
      if (!e) continue;
      const toAdd = [e.name, ...e.searchTerms];
      for (const t of toAdd) {
        const key = t.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        terms.push({ term: t, entityId, entityType: e.type });
      }
    }
  }

  terms.sort((a, b) => b.term.length - a.term.length);
  return terms;
}

/** Find all non-overlapping matches in text (case-insensitive), longest first */
function findMatches(text: string, terms: TermInfo[]): Array<{ start: number; end: number; entityId: string; entityType: EntityType; content: string }> {
  const lower = text.toLowerCase();
  const matches: Array<{ start: number; end: number; entityId: string; entityType: EntityType; content: string }> = [];
  const used: Array<[number, number]> = [];

  for (const { term, entityId, entityType } of terms) {
    const search = term.toLowerCase();
    let pos = 0;
    while (true) {
      const i = lower.indexOf(search, pos);
      if (i === -1) break;
      const end = i + search.length;
      const overlaps = used.some(([s, e]) => (i < e && end > s));
      if (!overlaps) {
        used.push([i, end]);
        matches.push({
          start: i,
          end,
          entityId,
          entityType,
          content: text.slice(i, end),
        });
      }
      pos = end;
    }
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/**
 * Split paragraph into text and link segments. Only entities present in the
 * chapter index for chapterNumber are linked.
 */
export function linkifyParagraph(paragraph: string, chapterNumber: number): Segment[] {
  const terms = getTermsForChapter(chapterNumber);
  if (terms.length === 0) return [{ type: "text", content: paragraph }];

  const matches = findMatches(paragraph, terms);
  if (matches.length === 0) return [{ type: "text", content: paragraph }];

  const segments: Segment[] = [];
  let lastEnd = 0;

  for (const m of matches) {
    if (m.start > lastEnd) {
      segments.push({ type: "text", content: paragraph.slice(lastEnd, m.start) });
    }
    segments.push({
      type: "link",
      content: m.content,
      entityId: m.entityId,
      entityType: m.entityType,
    });
    lastEnd = m.end;
  }

  if (lastEnd < paragraph.length) {
    segments.push({ type: "text", content: paragraph.slice(lastEnd) });
  }

  return segments;
}
