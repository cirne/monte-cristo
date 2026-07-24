/**
 * Companion locate: match an external reader's book title (e.g. Kindle Cloud Reader)
 * to a registered book, and locate a snippet of visible text to an exact
 * chapter + paragraph so the companion can deep-link into the same position.
 *
 * Pure logic — no data loading. Used by /api/companion/locate.
 */

export interface CompanionBookCandidate {
  slug: string;
  title: string;
  author: string;
}

export interface CompanionLocation {
  /** 1-based chapter number */
  chapter: number;
  /** 0-based paragraph index within the chapter (matches data-paragraph-index) */
  paragraph: number;
}

export interface ChapterParagraphs {
  number: number;
  paragraphs: string[];
}

/** Lowercase, strip diacritics + punctuation, collapse whitespace. */
export function normalizeForMatch(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&(mdash|ndash|nbsp|amp|quot|#\d+|#x[0-9a-f]+);/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop a leading "the " so "Count of Monte Cristo" matches "The Count of Monte Cristo". */
function dropLeadingArticle(normalized: string): string {
  return normalized.replace(/^the /, "");
}

const MIN_TITLE_MATCH_LENGTH = 6;

/**
 * Match an external reader title (often decorated, e.g.
 * "The Count of Monte Cristo (AmazonClassics Edition)") against registered books.
 * Containment either direction after normalization; prefers the longest matching title.
 */
export function matchBookByTitle(
  rawTitle: string,
  candidates: CompanionBookCandidate[]
): CompanionBookCandidate | null {
  const input = dropLeadingArticle(normalizeForMatch(rawTitle));
  if (input.length < MIN_TITLE_MATCH_LENGTH) return null;

  let best: CompanionBookCandidate | null = null;
  let bestLength = 0;
  for (const candidate of candidates) {
    const title = dropLeadingArticle(normalizeForMatch(candidate.title));
    if (title.length < MIN_TITLE_MATCH_LENGTH) continue;
    if (input.includes(title) || title.includes(input)) {
      if (title.length > bestLength) {
        best = candidate;
        bestLength = title.length;
      }
    }
  }
  return best;
}

const MIN_SNIPPET_WORDS = 4;
const MIN_SNIPPET_CHARS = 20;
/** Try progressively shorter needles: OCR/DOM noise at the end shouldn't sink the match. */
const NEEDLE_WORD_COUNTS = [30, 15, 8];

interface NormalizedChapter {
  number: number;
  /** Normalized paragraphs joined with a single space */
  joined: string;
  /** Start offset of each paragraph inside `joined` */
  paragraphOffsets: number[];
}

function normalizeChapter(chapter: ChapterParagraphs): NormalizedChapter {
  const parts: string[] = [];
  const paragraphOffsets: number[] = [];
  let offset = 0;
  for (const paragraph of chapter.paragraphs) {
    const normalized = normalizeForMatch(paragraph);
    paragraphOffsets.push(offset);
    parts.push(normalized);
    offset += normalized.length + 1; // +1 for the join space
  }
  return { number: chapter.number, joined: parts.join(" "), paragraphOffsets };
}

function paragraphIndexForOffset(chapter: NormalizedChapter, matchOffset: number): number {
  let result = 0;
  for (let i = 0; i < chapter.paragraphOffsets.length; i++) {
    if (chapter.paragraphOffsets[i] <= matchOffset) result = i;
    else break;
  }
  return result;
}

/**
 * Locate a snippet of visible reading text inside a book.
 * Returns the chapter + paragraph where the snippet begins, or null when not found.
 */
export function locateSnippet(
  chapters: ChapterParagraphs[],
  snippet: string
): CompanionLocation | null {
  const words = normalizeForMatch(snippet).split(" ").filter(Boolean);
  if (words.length < MIN_SNIPPET_WORDS) return null;

  const normalizedChapters = chapters.map(normalizeChapter);

  for (const wordCount of NEEDLE_WORD_COUNTS) {
    const needle = words.slice(0, wordCount).join(" ");
    if (needle.length < MIN_SNIPPET_CHARS) continue;
    for (const chapter of normalizedChapters) {
      const matchOffset = chapter.joined.indexOf(needle);
      if (matchOffset >= 0) {
        return {
          chapter: chapter.number,
          paragraph: paragraphIndexForOffset(chapter, matchOffset),
        };
      }
    }
  }
  return null;
}
