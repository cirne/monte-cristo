import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookIndex, getBookConfig, getVolumeLabels, isBookSlug } from "@/lib/book";
import { StartOrContinueLink } from "@/app/components/StartOrContinueLink";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const config = getBookConfig(slug);
  if (!config) return { title: "Not Found" };
  return { title: config.title };
}

export default async function BookHomePage({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) notFound();
  const config = getBookConfig(slug);
  if (!config) notFound();

  const book = getBookIndex(slug);
  if (!book) notFound();
  const volumeLabels = getVolumeLabels(slug);
  const frontMatter = book.frontMatter ?? [];
  const backMatter = book.backMatter ?? [];
  const volumeKeys = Object.keys(volumeLabels);
  const chaptersByVolume = volumeKeys.length
    ? volumeKeys.map((vol) => ({
        label: volumeLabels[vol],
        volume: vol,
        chapters: book.chapters.filter((c) => c.volume === vol),
      }))
    : [{ label: config.title, volume: "Full", chapters: book.chapters }];

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-stone-800 text-white dark:bg-amber-400 dark:text-stone-950 text-[3.375rem] mb-6 shadow-lg">
          {config.icon ?? "📖"}
        </div>
        <h1 className="text-4xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          {config.title}
        </h1>
        <p className="text-lg text-stone-500 dark:text-stone-400 mb-1">{config.author}</p>
        <p className="text-sm text-stone-400 dark:text-stone-500">
          {book.chapters.length} chapters
          {volumeKeys.length > 1 ? ` · ${volumeKeys.length} volumes` : ""} · Public Domain
        </p>

        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <StartOrContinueLink bookSlug={slug} />
          <Link
            href={`/book/${slug}/characters`}
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-stone-300 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-900 transition-colors"
          >
            Character Guide
          </Link>
          <Link
            href={`/book/${slug}/search`}
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-stone-300 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-900 transition-colors"
          >
            Search
          </Link>
        </div>
      </div>

      {/* Table of contents */}
      <div>
        <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-200 mb-6">Contents</h2>
        <div className="space-y-8">
          {frontMatter.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3 border-b border-stone-200 dark:border-stone-800 pb-2">
                Front matter
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {frontMatter.map((section) => (
                  <Link
                    key={section.id}
                    href={`/book/${slug}/section/${section.id}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors group"
                  >
                    <span className="text-sm text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 leading-snug">
                      {section.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {chaptersByVolume.map(({ label, chapters }) => (
            <div key={label}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3 border-b border-stone-200 dark:border-stone-800 pb-2">
                {label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {chapters.map((chapter) => (
                  <Link
                    key={chapter.number}
                    href={`/book/${slug}/chapter/${chapter.number}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors group"
                  >
                    <span className="flex-shrink-0 w-8 text-right text-xs text-stone-400 dark:text-stone-500 mt-0.5 font-mono">
                      {chapter.number}
                    </span>
                    <span className="text-sm text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 leading-snug">
                      {chapter.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {backMatter.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3 border-b border-stone-200 dark:border-stone-800 pb-2">
                Back matter
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {backMatter.map((section) => (
                  <Link
                    key={section.id}
                    href={`/book/${slug}/section/${section.id}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors group"
                  >
                    <span className="text-sm text-stone-700 dark:text-stone-300 group-hover:text-stone-900 dark:group-hover:text-stone-100 leading-snug">
                      {section.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
