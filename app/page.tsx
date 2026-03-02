import Link from "next/link";
import { BOOK_SLUGS, getBookConfig } from "@/lib/books";

export default function Home() {
  const books = BOOK_SLUGS.map((slug) => ({
    slug,
    config: getBookConfig(slug)!,
  }));

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-stone-800 text-white dark:bg-amber-400 dark:text-stone-950 text-4xl mb-6 shadow-lg">
          📚
        </div>
        <h1 className="text-4xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          Monte Cristo Reader
        </h1>
        <p className="text-lg text-stone-500 dark:text-stone-400">
          Pick a book to start reading with X-Ray style context.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {books.map(({ slug, config }) => (
          <Link
            key={slug}
            href={`/book/${slug}`}
            className="block p-6 rounded-xl border border-stone-200 bg-white dark:bg-stone-900 dark:border-stone-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
          >
            <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-1">
              {config.title}
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">{config.author}</p>
            <span className="inline-block mt-3 text-sm font-medium text-amber-600 dark:text-amber-400">
              Open book →
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
