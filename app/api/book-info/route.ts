import { getBookConfig, getBookIndex, isBookSlug } from "@/lib/book";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug || !isBookSlug(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }
  const config = getBookConfig(slug);
  if (!config) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  const index = getBookIndex(slug);
  if (!index) return NextResponse.json({ error: "Book data not found" }, { status: 404 });
  return NextResponse.json({
    title: config.title,
    author: config.author,
    storageKey: config.storageKey,
    volumeLabels: config.volumeLabels,
    totalChapters: index.chapters.length,
  });
}
