import { getBook } from "@/lib/book";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q ?? "" });
  }

  const book = getBook();
  const queryLower = q.toLowerCase();

  const results = book.chapters
    .filter(
      (chapter) =>
        chapter.title.toLowerCase().includes(queryLower) ||
        chapter.content.toLowerCase().includes(queryLower)
    )
    .slice(0, 20)
    .map((chapter) => {
      // Find a relevant excerpt around the first match
      const contentLower = chapter.content.toLowerCase();
      const matchIdx = contentLower.indexOf(queryLower);
      let excerpt = "";
      if (matchIdx >= 0) {
        const start = Math.max(0, matchIdx - 80);
        const end = Math.min(chapter.content.length, matchIdx + q.length + 120);
        excerpt =
          (start > 0 ? "…" : "") +
          chapter.content.slice(start, end).replace(/\n/g, " ").trim() +
          (end < chapter.content.length ? "…" : "");
      } else {
        excerpt = chapter.content.slice(0, 200).replace(/\n/g, " ") + "…";
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
