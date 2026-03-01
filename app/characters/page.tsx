import Link from "next/link";
import { getBook } from "@/lib/book";
import { CHARACTERS } from "@/lib/characters";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Characters — The Count of Monte Cristo",
  description:
    "X-Ray style character guide for The Count of Monte Cristo — track every character across 117 chapters.",
};

const ROLE_LABELS: Record<string, string> = {
  protagonist: "Protagonist",
  antagonist: "Antagonist",
  ally: "Ally",
  supporting: "Supporting",
};

const ROLE_COLORS: Record<string, string> = {
  protagonist: "bg-amber-100 text-amber-800",
  antagonist: "bg-red-100 text-red-800",
  ally: "bg-green-100 text-green-800",
  supporting: "bg-stone-100 text-stone-700",
};

const ROLE_ICONS: Record<string, string> = {
  protagonist: "⭐",
  antagonist: "⚔️",
  ally: "🤝",
  supporting: "👤",
};

export default function CharactersPage() {
  const book = getBook();

  // For each character, find which chapters they appear in
  const charactersWithChapters = CHARACTERS.map((char) => {
    const appearances = book.chapters
      .filter((chapter) =>
        char.searchTerms.some((term) => chapter.content.includes(term))
      )
      .map((chapter) => ({ number: chapter.number, title: chapter.title }));

    return { ...char, appearances };
  });

  // Sort: protagonist first, then antagonist, then ally, then supporting
  const roleOrder = ["protagonist", "antagonist", "ally", "supporting"];
  const sorted = [...charactersWithChapters].sort(
    (a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="text-xs text-stone-400 hover:text-stone-600 mb-4 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-stone-900 mb-1">Character Guide</h1>
        <p className="text-stone-500">
          Track every major character across all {book.chapters.length} chapters — X-Ray style.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sorted.map((char) => (
          <div
            key={char.id}
            id={char.id}
            className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                  <span>{ROLE_ICONS[char.role]}</span>
                  {char.name}
                </h2>
                {char.aliases.length > 0 && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    Also known as: {char.aliases.join(", ")}
                  </p>
                )}
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${ROLE_COLORS[char.role]}`}
              >
                {ROLE_LABELS[char.role]}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-stone-600 leading-relaxed mb-4">{char.description}</p>

            {/* Chapter appearances */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
                Appears in {char.appearances.length} chapters
              </p>
              {char.appearances.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {char.appearances.map((ch) => (
                    <Link
                      key={ch.number}
                      href={`/chapter/${ch.number}`}
                      title={`Chapter ${ch.number}: ${ch.title}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-mono bg-stone-100 text-stone-600 hover:bg-amber-100 hover:text-amber-800 transition-colors"
                    >
                      {ch.number}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">No appearances found</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
