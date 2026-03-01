import Link from "next/link";
import { getBookIndex, VOLUME_LABELS } from "@/lib/book";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Chapters — The Count of Monte Cristo",
};

export default function ChaptersPage() {
  const book = getBookIndex();
  const volumeKeys = Object.keys(VOLUME_LABELS);

  const chaptersByVolume = volumeKeys.map((vol) => ({
    key: vol,
    label: VOLUME_LABELS[vol],
    chapters: book.chapters.filter((c) => c.volume === vol),
  }));

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href="/"
          className="text-xs text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100">All Chapters</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          {book.chapters.length} chapters across 5 volumes
        </p>
      </div>

      <div className="space-y-10">
        {chaptersByVolume.map(({ key, label, chapters }) => (
          <section key={key}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800 pb-2 mb-4">
              {label} · {chapters.length} chapters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {chapters.map((chapter) => (
                <Link
                  key={chapter.number}
                  href={`/chapter/${chapter.number}`}
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
      </div>
    </main>
  );
}
