import { type NextRequest, NextResponse } from "next/server";
import { BOOK_SLUGS } from "@/lib/books";
import { getBook, getBookConfig, getBookIndex } from "@/lib/book";
import { getParagraphs } from "@/lib/scenes";
import {
  matchBookByTitle,
  locateSnippet,
  type CompanionBookCandidate,
} from "@/lib/companion-locate";

/**
 * Companion locate endpoint: given an external reader's book title (e.g. from
 * Kindle Cloud Reader) and optionally a snippet of visible text, return the
 * matching registered book and a deep link to the same chapter + paragraph.
 *
 * CORS is open: the browser-extension content script calls this from another origin.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_TEXT_LENGTH = 4000;

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";
  const text = request.nextUrl.searchParams.get("text")?.trim().slice(0, MAX_TEXT_LENGTH) ?? "";

  if (!title) {
    return NextResponse.json(
      { found: false, error: "Missing title" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const candidates: CompanionBookCandidate[] = [];
  for (const slug of BOOK_SLUGS) {
    const config = getBookConfig(slug);
    if (!config) continue;
    if (!getBookIndex(slug)) continue; // only offer books whose data exists
    candidates.push({ slug, title: config.title, author: config.author });
  }

  const match = matchBookByTitle(title, candidates);
  if (!match) {
    return NextResponse.json({ found: false }, { headers: CORS_HEADERS });
  }

  let location: { chapter: number; paragraph: number } | null = null;
  if (text) {
    const book = getBook(match.slug);
    if (book) {
      location = locateSnippet(
        book.chapters.map((chapter) => ({
          number: chapter.number,
          paragraphs: getParagraphs(chapter.content),
        })),
        text
      );
    }
  }

  const url = location
    ? `/book/${match.slug}/chapter/${location.chapter}?paragraph=${location.paragraph}`
    : `/book/${match.slug}`;

  return NextResponse.json(
    {
      found: true,
      slug: match.slug,
      bookTitle: match.title,
      author: match.author,
      url,
      chapter: location?.chapter ?? null,
      paragraph: location?.paragraph ?? null,
    },
    { headers: CORS_HEADERS }
  );
}
