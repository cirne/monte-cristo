import { notFound } from "next/navigation";
import Link from "next/link";
import { getSection, getBookIndex, getBookConfig, isBookSlug } from "@/lib/book";
import { getParagraphs } from "@/lib/scenes";
import { BOOK_SLUGS } from "@/lib/books";
import { ChapterContent } from "@/app/chapter/[number]/ChapterContent";
import type { Segment } from "@/lib/linkify";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string; sectionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sectionId } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const section = getSection(slug, sectionId);
  if (!section) return { title: "Not Found" };
  const config = getBookConfig(slug);
  const title = config?.title ?? slug;
  return {
    title: `${section.title} — ${title}`,
  };
}

export async function generateStaticParams() {
  const params: { slug: string; sectionId: string }[] = [];
  for (const slug of BOOK_SLUGS) {
    if (!isBookSlug(slug)) continue;
    const index = getBookIndex(slug);
    if (!index) continue;
    for (const s of index.frontMatter ?? []) {
      params.push({ slug, sectionId: s.id });
    }
    for (const s of index.backMatter ?? []) {
      params.push({ slug, sectionId: s.id });
    }
  }
  return params;
}

/** Format section content into paragraph segments (no entity links). */
function formatContent(content: string): Segment[][] {
  const paragraphs = getParagraphs(content);
  return paragraphs.map((p) => [{ type: "text" as const, content: p }]);
}

export default async function SectionPage({ params }: Props) {
  const { slug, sectionId } = await params;
  if (!isBookSlug(slug)) notFound();

  const section = getSection(slug, sectionId);
  if (!section) notFound();

  const paragraphSegments = formatContent(section.content);
  const config = getBookConfig(slug);
  const bookTitle = config?.title ?? slug;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
          {bookTitle}
        </p>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">{section.title}</h1>
      </div>

      <article className="flex-1 min-w-0">
        <ChapterContent
          paragraphSegments={paragraphSegments}
          scenes={[]}
          chapterNumber={0}
          xrayData={{}}
        />
      </article>

      <nav className="mt-12 pt-6 border-t border-stone-200 dark:border-stone-800">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          <span className="text-lg">←</span>
          Back to {bookTitle}
        </Link>
      </nav>
    </main>
  );
}
