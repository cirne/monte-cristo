import { notFound } from "next/navigation";
import Link from "next/link";
import { getChapter, getBookIndex, VOLUME_LABELS } from "@/lib/book";
import { CHARACTERS } from "@/lib/characters";
import type { Metadata } from "next";

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

/** Returns which characters appear in the given chapter content */
function getChapterCharacters(content: string) {
  return CHARACTERS.filter((char) =>
    char.searchTerms.some((term) => content.includes(term))
  );
}

/** Format chapter content into paragraphs */
function formatContent(content: string) {
  return content
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export default async function ChapterPage({ params }: Props) {
  const { number } = await params;
  const num = parseInt(number, 10);
  if (isNaN(num)) notFound();

  const chapter = getChapter(num);
  if (!chapter) notFound();

  const book = getBookIndex();
  const total = book.chapters.length;
  const prev = num > 1 ? num - 1 : null;
  const next = num < total ? num + 1 : null;
  const progress = Math.round((num / total) * 100);

  const characters = getChapterCharacters(chapter.content);
  const paragraphs = formatContent(chapter.content);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="fixed top-[49px] left-0 right-0 h-0.5 bg-stone-200 z-10">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Breadcrumb */}
      <div className="text-xs text-stone-400 mb-6 flex items-center gap-2">
        <Link href="/" className="hover:text-stone-600">Home</Link>
        <span>›</span>
        <Link href="/chapters" className="hover:text-stone-600">Chapters</Link>
        <span>›</span>
        <span className="text-stone-600">{VOLUME_LABELS[chapter.volume]}</span>
        <span>›</span>
        <span className="text-stone-600">Chapter {chapter.number}</span>
      </div>

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
          <div className="prose prose-stone prose-lg max-w-none">
            {paragraphs.map((para, i) => (
              <p key={i} className="mb-4 leading-relaxed text-stone-800">
                {para}
              </p>
            ))}
          </div>
        </article>

        {/* Sidebar: Characters in this chapter */}
        {characters.length > 0 && (
          <aside className="lg:w-56 flex-shrink-0">
            <div className="sticky top-16 bg-white border border-stone-200 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
                Characters in this chapter
              </h3>
              <ul className="space-y-2">
                {characters.map((char) => (
                  <li key={char.id}>
                    <Link
                      href={`/characters#${char.id}`}
                      className="text-sm text-stone-700 hover:text-amber-700 font-medium block"
                    >
                      {char.name}
                    </Link>
                    <p className="text-xs text-stone-400 leading-snug">
                      {char.role}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
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
