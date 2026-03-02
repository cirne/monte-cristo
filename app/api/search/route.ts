import { getBook } from "@/lib/book";
import { stripHtmlToText } from "@/lib/canonical-html";
import { DEFAULT_BOOK_SLUG, isBookSlug } from "@/lib/books";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const bookParam = request.nextUrl.searchParams.get("book")?.trim();
  const slug = bookParam && isBookSlug(bookParam) ? bookParam : DEFAULT_BOOK_SLUG;

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q ?? "" });
  }

  const book = getBook(slug);
  if (!book) {
    return NextResponse.json({ results: [], query: q ?? "", total: 0 });
  }
  const queryLower = q.toLowerCase();

  const results = book.chapters
    .filter((chapter) => {
      const plain = stripHtmlToText(chapter.content);
      return (
        chapter.title.toLowerCase().includes(queryLower) || plain.toLowerCase().includes(queryLower)
      );
    })
    .slice(0, 20)
    .map((chapter) => {
      const plainContent = stripHtmlToText(chapter.content);
      const contentLower = plainContent.toLowerCase();
      const matchIdx = contentLower.indexOf(queryLower);
      let excerpt = "";
      if (matchIdx >= 0) {
        const start = Math.max(0, matchIdx - 80);
        const end = Math.min(plainContent.length, matchIdx + q.length + 120);
        excerpt =
          (start > 0 ? "…" : "") +
          plainContent.slice(start, end).replace(/\n/g, " ").trim() +
          (end < plainContent.length ? "…" : "");
      } else {
        excerpt = plainContent.slice(0, 200).replace(/\n/g, " ").trim() + "…";
      }

      return {
        number: chapter.number,
        title: chapter.title,
        volume: chapter.volume,
        excerpt,
      };
    });

  return NextResponse.json({ results, query: q, total: results.length });
}
