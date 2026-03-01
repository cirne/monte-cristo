/**
 * Turns paragraph text into segments (plain text and entity links) for the chapter page.
 * Only links entities that appear in the chapter index for the given chapter.
 * Longest match wins to avoid overlapping links (e.g. "Comte de Morcerf" over "Morcerf").
 */

import { getCharacter } from "./characters";
import { getPlaceOrEvent } from "./entities";
import { getStoredEntity } from "./entity-store";
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

interface PatternInfo {
  pattern: string;
  entityId: string;
  entityType: EntityType;
}

/** Build regex pattern list for entities in this chapter that have matchPatterns */
function getPatternsForChapter(chapterNumber: number): PatternInfo[] {
  const entry = getChapterIndexEntry(chapterNumber);
  if (!entry) return [];

  const patterns: PatternInfo[] = [];
  for (const { entityId, type } of entry.entities) {
    if (type === "person") {
      const c = getCharacter(entityId);
      const stored = getStoredEntity(entityId);
      const matchPatterns = c?.matchPatterns ?? stored?.matchPatterns;
      if (matchPatterns?.length) {
        for (const p of matchPatterns) {
          patterns.push({ pattern: p, entityId, entityType: "person" });
        }
      }
    } else {
      const e = getPlaceOrEvent(entityId);
      const stored = getStoredEntity(entityId);
      const matchPatterns = e?.matchPatterns ?? stored?.matchPatterns;
      if (matchPatterns?.length) {
        for (const p of matchPatterns) {
          patterns.push({ pattern: p, entityId, entityType: (e ?? stored)!.type });
        }
      }
    }
  }
  return patterns;
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
      const stored = getStoredEntity(entityId);
      const toAdd = c
        ? [c.name, ...c.aliases, ...c.searchTerms]
        : stored
          ? [stored.name, ...stored.aliases, ...stored.searchTerms]
          : [];
      if (!toAdd.length) continue;
      for (const t of toAdd) {
        const key = t.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        terms.push({ term: t, entityId, entityType: "person" });
      }
    } else {
      const e = getPlaceOrEvent(entityId);
      const stored = getStoredEntity(entityId);
      const toAdd = e
        ? [e.name, ...e.searchTerms]
        : stored
          ? [stored.name, ...stored.searchTerms]
          : [];
      if (!toAdd.length) continue;
      for (const t of toAdd) {
        const key = t.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        terms.push({ term: t, entityId, entityType: (e ?? stored)!.type });
      }
    }
  }

  terms.sort((a, b) => b.term.length - a.term.length);
  return terms;
}

type Match = { start: number; end: number; entityId: string; entityType: EntityType; content: string };

/** Find all matches from regex patterns (word-boundary wrapped for safety) */
function findRegexMatches(text: string, patterns: PatternInfo[]): Match[] {
  const matches: Match[] = [];
  const normalized = text.normalize("NFC");
  for (const { pattern, entityId, entityType } of patterns) {
    try {
      const re = new RegExp(`(?:${pattern})`, "giu");
      let m: RegExpExecArray | null;
      while ((m = re.exec(normalized)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          entityId,
          entityType,
          content: text.slice(m.index, m.index + m[0].length),
        });
      }
    } catch {
      // skip invalid pattern
    }
  }
  return matches;
}

/** Resolve overlapping matches: keep longest at each position */
function resolveOverlaps(matches: Match[]): Match[] {
  if (matches.length === 0) return [];
  const byLength = [...matches].sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const out: Match[] = [];
  for (const m of byLength) {
    const overlaps = out.some((o) => m.start < o.end && m.end > o.start);
    if (!overlaps) out.push(m);
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Find all non-overlapping matches (regex first, then literal terms). Longest match wins on overlap. */
function findMatches(
  text: string,
  terms: TermInfo[],
  patterns: PatternInfo[]
): Array<{ start: number; end: number; entityId: string; entityType: EntityType; content: string }> {
  const regexMatches = findRegexMatches(text, patterns);
  const normalized = (s: string) => s.toLowerCase().normalize("NFC");
  const lower = normalized(text);
  const literalMatches: Match[] = [];
  const used: Array<[number, number]> = [];

  for (const { term, entityId, entityType } of terms) {
    const search = normalized(term);
    if (!search) continue;
    let pos = 0;
    while (true) {
      const i = lower.indexOf(search, pos);
      if (i === -1) break;
      const end = i + search.length;
      const overlaps = used.some(([s, e]) => (i < e && end > s));
      if (!overlaps) {
        used.push([i, end]);
        literalMatches.push({
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

  return resolveOverlaps([...regexMatches, ...literalMatches]);
}

/**
 * Split paragraph into text and link segments. Only entities present in the
 * chapter index for chapterNumber are linked.
 */
export function linkifyParagraph(paragraph: string, chapterNumber: number): Segment[] {
  const terms = getTermsForChapter(chapterNumber);
  const patterns = getPatternsForChapter(chapterNumber);
  if (terms.length === 0 && patterns.length === 0) return [{ type: "text", content: paragraph }];

  const matches = findMatches(paragraph, terms, patterns);
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
