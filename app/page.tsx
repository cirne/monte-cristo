import Link from "next/link";
import { getBookIndex, VOLUME_LABELS } from "@/lib/book";
import { StartOrContinueLink } from "./components/StartOrContinueLink";

export default function Home() {
  const book = getBookIndex();
  const volumeGroups = VOLUME_LABELS;

  const chaptersByVolume = Object.keys(volumeGroups).map((vol) => ({
    label: volumeGroups[vol],
    volume: vol,
    chapters: book.chapters.filter((c) => c.volume === vol),
  }));

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-stone-800 text-white text-4xl mb-6 shadow-lg">
          ⚓
        </div>
        <h1 className="text-4xl font-bold text-stone-900 mb-2">
          The Count of Monte Cristo
        </h1>
        <p className="text-lg text-stone-500 mb-1">Alexandre Dumas, père</p>
        <p className="text-sm text-stone-400">
          {book.chapters.length} chapters · 5 volumes · Public Domain
        </p>

        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <StartOrContinueLink />
          <Link
            href="/characters"
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-stone-300 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-100 transition-colors"
          >
            Character Guide
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-6 py-2.5 border border-stone-300 text-stone-700 rounded-full text-sm font-medium hover:bg-stone-100 transition-colors"
          >
            Search
          </Link>
        </div>
      </div>

      {/* Introduction */}
      <div className="mb-10 p-6 bg-amber-50 border border-amber-100 rounded-xl">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-700 mb-2">
          Introduction
        </h2>
        <p className="text-stone-700 leading-relaxed">
          Set in France and the Mediterranean in the early 19th century, Alexandre Dumas&apos;s
          masterpiece follows Edmond Dantès, a young merchant sailor from Marseille on the eve of his
          wedding. What begins as a story of love and promise soon becomes an epic of injustice,
          transformation, and the enduring question of how far one man will go for justice.
        </p>
      </div>

      {/* Chapter List by Volume */}
      <div>
        <h2 className="text-xl font-semibold text-stone-800 mb-6">Chapters</h2>
        <div className="space-y-8">
          {chaptersByVolume.map(({ label, chapters }) => (
            <div key={label}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3 border-b border-stone-200 pb-2">
                {label}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {chapters.map((chapter) => (
                  <Link
                    key={chapter.number}
                    href={`/chapter/${chapter.number}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-100 transition-colors group"
                  >
                    <span className="flex-shrink-0 w-8 text-right text-xs text-stone-400 mt-0.5 font-mono">
                      {chapter.number}
                    </span>
                    <span className="text-sm text-stone-700 group-hover:text-stone-900 leading-snug">
                      {chapter.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
