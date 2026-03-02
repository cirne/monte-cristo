import { notFound } from "next/navigation";
import Link from "next/link";
import { getChapter, getBookIndex, getBookConfig, getVolumeLabels, isBookSlug } from "@/lib/book";
import { getStoredEntity } from "@/lib/entity-store";
import { getChapterIndexEntry } from "@/lib/chapter-index";
import { getParagraphs } from "@/lib/scenes";
import { linkifyParagraph } from "@/lib/linkify";
import { ChapterContent } from "@/app/chapter/[number]/ChapterContent";
import type { Metadata } from "next";
import type { XRayEntityData } from "@/app/chapter/[number]/XRayPanel";
import { BOOK_SLUGS } from "@/lib/books";

interface Props {
  params: Promise<{ slug: string; number: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, number } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const config = getBookConfig(slug);
  const chapter = getChapter(slug, parseInt(number, 10));
  if (!chapter || !config) return { title: "Not Found" };
  return {
    title: `Ch. ${chapter.number}: ${chapter.title} — ${config.title}`,
  };
}

export async function generateStaticParams() {
  const params: { slug: string; number: string }[] = [];
  for (const slug of BOOK_SLUGS) {
    if (!isBookSlug(slug)) continue;
    const book = getBookIndex(slug);
    if (!book) continue;
    for (const c of book.chapters) {
      params.push({ slug, number: String(c.number) });
    }
  }
  return params;
}

function formatContent(content: string) {
  return getParagraphs(content);
}

function buildXRayData(
  slug: string,
  chapterNumber: number,
  entry: ReturnType<typeof getChapterIndexEntry>
): Record<string, XRayEntityData> {
  const data: Record<string, XRayEntityData> = {};
  if (!entry) return data;

  for (const { entityId, type, firstSeenInChapter, excerpt } of entry.entities) {
    const stored = getStoredEntity(slug, entityId);
    if (!stored) continue;
    data[entityId] = {
      name: stored.name,
      aliases: type === "person" ? stored.aliases : [],
      spoilerFreeIntro: stored.spoilerFreeIntro,
      firstSeenInChapter,
      excerpt,
      type: stored.type,
    };
  }
  return data;
}

export default async function BookChapterPage({ params, searchParams }: Props) {
  const { slug, number } = await params;
  const sp = await searchParams;
  const scrollToEntityId =
    typeof sp?.scrollTo === "string" && sp.scrollTo.trim() ? sp.scrollTo.trim() : undefined;
  if (!isBookSlug(slug)) notFound();
  const config = getBookConfig(slug);
  if (!config) notFound();

  const num = parseInt(number, 10);
  if (isNaN(num)) notFound();

  const chapter = getChapter(slug, num);
  if (!chapter) notFound();

  const indexEntry = getChapterIndexEntry(slug, num);
  const paragraphStrings = formatContent(chapter.content);
  const paragraphSegments = paragraphStrings.map((p) => linkifyParagraph(p, num, slug));
  const scenes = indexEntry?.scenes ?? [];
  const xrayData = buildXRayData(slug, num, indexEntry);
  const baselineIntro = indexEntry?.number === 1 ? indexEntry.baselineIntro : undefined;

  const book = getBookIndex(slug);
  if (!book) notFound();
  const volumeLabels = getVolumeLabels(slug);
  const total = book.chapters.length;
  const prev = num > 1 ? num - 1 : null;
  const next = num < total ? num + 1 : null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
          {volumeLabels[chapter.volume] ?? chapter.volume}
        </p>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-1">
          Chapter {chapter.number}
        </h1>
        <h2 className="text-xl text-stone-500 dark:text-stone-400">{chapter.title}</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <article className="flex-1 min-w-0">
          <ChapterContent
            paragraphSegments={paragraphSegments}
            scenes={scenes}
            chapterNumber={num}
            xrayData={xrayData}
            baselineIntro={baselineIntro}
            bookSlug={slug}
            scrollToEntityId={scrollToEntityId}
          />
        </article>
      </div>

      <nav className="mt-12 pt-6 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
        {prev ? (
          <Link
            href={`/book/${slug}/chapter/${prev}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 group"
          >
            <span className="text-lg group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>
              <span className="block text-xs text-stone-400 dark:text-stone-500">Previous</span>
              Chapter {prev}
            </span>
          </Link>
        ) : (
          <div />
        )}

        <span className="text-xs text-stone-400 dark:text-stone-500">
          {num} / {total}
        </span>

        {next ? (
          <Link
            href={`/book/${slug}/chapter/${next}`}
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 group text-right"
          >
            <span>
              <span className="block text-xs text-stone-400 dark:text-stone-500">Next</span>
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
