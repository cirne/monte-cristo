"use client";

import React from "react";
import type { StoredEntity } from "@/lib/entity-store";
import { CharacterCard } from "./CharacterCard";

export interface CharacterWithAppearance {
  entity: StoredEntity;
  firstAppearance: { number: number; title: string } | null;
}

interface CharacterGuideProps {
  slug: string;
  characters: CharacterWithAppearance[];
}

function matchesSearch(entity: StoredEntity, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  if (entity.name.toLowerCase().includes(q)) return true;
  return entity.aliases.some((a) => a.toLowerCase().includes(q));
}

export function CharacterGuide({ slug, characters }: CharacterGuideProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(
    () => characters.filter(({ entity }) => matchesSearch(entity, query)),
    [characters, query]
  );

  return (
    <>
      <div className="mb-6">
        <label htmlFor="character-search" className="sr-only">
          Search characters
        </label>
        <input
          id="character-search"
          type="search"
          placeholder="Search characters..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 dark:focus:ring-amber-500/50 dark:focus:border-amber-500"
          aria-describedby={query ? "character-search-result" : undefined}
        />
        {query && (
          <p id="character-search-result" className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
            {filtered.length} character{filtered.length !== 1 ? "s" : ""} match
            {filtered.length !== 1 ? "" : "es"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map(({ entity, firstAppearance }) => (
          <CharacterCard
            key={entity.id}
            entity={entity}
            slug={slug}
            firstAppearance={firstAppearance}
          />
        ))}
      </div>
    </>
  );
}
