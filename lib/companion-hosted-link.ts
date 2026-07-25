/**
 * Optional deep-link into the hosted public-domain reader when the Kindle
 * title matches a registered book.
 */

import { BOOK_SLUGS } from "./books";
import { getBook, getBookConfig, getBookIndex } from "./book";
import { getParagraphs } from "./scenes";
import {
  locateSnippet,
  matchBookByTitle,
  type CompanionBookCandidate,
} from "./companion-locate";

export function resolveHostedReaderUrl(
  title: string,
  text?: string
): string | null {
  const candidates: CompanionBookCandidate[] = [];
  for (const slug of BOOK_SLUGS) {
    const config = getBookConfig(slug);
    if (!config) continue;
    if (!getBookIndex(slug)) continue;
    candidates.push({ slug, title: config.title, author: config.author });
  }

  const match = matchBookByTitle(title, candidates);
  if (!match) return null;

  if (text?.trim()) {
    const book = getBook(match.slug);
    if (book) {
      const location = locateSnippet(
        book.chapters.map((chapter) => ({
          number: chapter.number,
          paragraphs: getParagraphs(chapter.content),
        })),
        text
      );
      if (location) {
        return `/book/${match.slug}/chapter/${location.chapter}?paragraph=${location.paragraph}`;
      }
    }
  }

  return `/book/${match.slug}`;
}
