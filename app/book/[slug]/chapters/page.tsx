import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookIndex, getBookConfig, getVolumeLabels, isBookSlug } from "@/lib/book";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) return { title: "Not Found" };
  const config = getBookConfig(slug);
  if (!config) return { title: "Not Found" };
  return { title: `All Chapters — ${config.title}` };
}

export default async function BookChaptersPage({ params }: Props) {
  const { slug } = await params;
  if (!isBookSlug(slug)) notFound();
  const config = getBookConfig(slug);
  if (!config) notFound();

  const book = getBookIndex(slug);
  if (!book) notFound();
  const volumeLabels = getVolumeLabels(slug);
  const volumeKeys = Object.keys(volumeLabels);
  const frontMatter = book.frontMatter ?? [];
  const backMatter = book.backMatter ?? [];

  const chaptersByVolume =
    volumeKeys.length > 0
      ? volumeKeys.map((vol) => ({
          key: vol,
          label: volumeLabels[vol],
          chapters: book.chapters.filter((c) => c.volume === vol),
        }))
      : [{ key: "Full", label: config.title, chapters: book.chapters }];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={`/book/${slug}`}
          className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">All Chapters</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          {book.chapters.length} chapters
          {volumeKeys.length > 1 ? ` across ${volumeKeys.length} volumes` : ""}
          {frontMatter.length + backMatter.length > 0 &&
            ` · ${frontMatter.length + backMatter.length} other sections`}
        </p>
      </div>

      <div className="space-y-10">
        {frontMatter.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800 pb-2 mb-4">
              Front matter
            </h2>
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
          </section>
        )}
        {chaptersByVolume.map(({ key, label, chapters }) => (
          <section key={key}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800 pb-2 mb-4">
              {label} · {chapters.length} chapters
            </h2>
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
          </section>
        ))}
        {backMatter.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800 pb-2 mb-4">
              Back matter
            </h2>
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
          </section>
        )}
      </div>
    </main>
  );
}
