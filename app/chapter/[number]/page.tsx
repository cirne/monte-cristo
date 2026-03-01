import { notFound } from "next/navigation";
import Link from "next/link";
import { getChapter, getBookIndex, VOLUME_LABELS } from "@/lib/book";
import { getCharacter } from "@/lib/characters";
import { getPlaceOrEvent } from "@/lib/entities";
import { getStoredEntity } from "@/lib/entity-store";
import { getChapterIndexEntry } from "@/lib/chapter-index";
import { getParagraphs } from "@/lib/scenes";
import { linkifyParagraph } from "@/lib/linkify";
import { ChapterContent } from "./XRayPanel";
import type { Metadata } from "next";
import type { XRayEntityData } from "./XRayPanel";

interface Props {
  params: Promise<{ number: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const chapter = getChapter(parseInt(number, 10));
  if (!chapter) return { title: "Not Found" };
  return {
    title: `Ch. ${chapter.number}: ${chapter.title} — The Count of Monte Cristo`,
  };
}

export async function generateStaticParams() {
  const book = getBookIndex();
  return book.chapters.map((c) => ({ number: String(c.number) }));
}

/** Format chapter content into paragraphs (same split as indexer uses for scene boundaries). */
function formatContent(content: string) {
  return getParagraphs(content);
}

/** Build X-Ray data for all entities in this chapter (spoiler-free) */
function buildXRayData(
  chapterNumber: number,
  entry: ReturnType<typeof getChapterIndexEntry>
): Record<string, XRayEntityData> {
  const data: Record<string, XRayEntityData> = {};
  if (!entry) return data;

  for (const { entityId, type, firstSeenInChapter, excerpt } of entry.entities) {
    if (type === "person") {
      const c = getCharacter(entityId);
      const stored = getStoredEntity(entityId);
      const source = c ?? stored;
      if (!source) continue;
      data[entityId] = {
        name: source.name,
        aliases: "aliases" in source ? source.aliases : [],
        spoilerFreeIntro: source.spoilerFreeIntro,
        firstSeenInChapter,
        excerpt,
        type: "person",
      };
    } else {
      const e = getPlaceOrEvent(entityId);
      const stored = getStoredEntity(entityId);
      const source = e ?? stored;
      if (!source) continue;
      data[entityId] = {
        name: source.name,
        aliases: [],
        spoilerFreeIntro: source.spoilerFreeIntro,
        firstSeenInChapter,
        excerpt,
        type: source.type,
      };
    }
  }
  return data;
}

export default async function ChapterPage({ params }: Props) {
  const { number } = await params;
  const num = parseInt(number, 10);
  if (isNaN(num)) notFound();

  const chapter = getChapter(num);
  if (!chapter) notFound();

  const indexEntry = getChapterIndexEntry(num);
  const paragraphStrings = formatContent(chapter.content);
  const paragraphSegments = paragraphStrings.map((p) => linkifyParagraph(p, num));
  const scenes = indexEntry?.scenes ?? [];
  const xrayData = buildXRayData(num, indexEntry);
  const baselineIntro = indexEntry?.number === 1 ? indexEntry.baselineIntro : undefined;

  const book = getBookIndex();
  const total = book.chapters.length;
  const prev = num > 1 ? num - 1 : null;
  const next = num < total ? num + 1 : null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Chapter header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-1">
          {VOLUME_LABELS[chapter.volume]}
        </p>
        <h1 className="text-3xl font-bold text-stone-900 mb-1">
          Chapter {chapter.number}
        </h1>
        <h2 className="text-xl text-stone-500">{chapter.title}</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Chapter text */}
        <article className="flex-1 min-w-0">
          <ChapterContent
            paragraphSegments={paragraphSegments}
            scenes={scenes}
            chapterNumber={num}
            xrayData={xrayData}
            baselineIntro={baselineIntro}
          />
        </article>
      </div>

      {/* Navigation */}
      <nav className="mt-12 pt-6 border-t border-stone-200 flex items-center justify-between gap-4">
        {prev ? (
          <Link
            href={`/chapter/${prev}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 group"
          >
            <span className="text-lg group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>
              <span className="block text-xs text-stone-400">Previous</span>
              Chapter {prev}
            </span>
          </Link>
        ) : (
          <div />
        )}

        <span className="text-xs text-stone-400">
          {num} / {total}
        </span>

        {next ? (
          <Link
            href={`/chapter/${next}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 group text-right"
          >
            <span>
              <span className="block text-xs text-stone-400">Next</span>
              Chapter {next}
            </span>
            <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </main>
  );
}
