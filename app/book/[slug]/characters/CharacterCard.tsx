"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { StoredEntity } from "@/lib/entity-store";

interface CharacterCardProps {
  entity: StoredEntity;
  slug: string;
  firstAppearance: { number: number; title: string } | null;
}

import { getImageBase } from "@/lib/env";

const entitiesBaseFor = (slug: string) => `${getImageBase()}/entities/${slug}`;

export function CharacterCard({ entity, slug, firstAppearance }: CharacterCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const entitiesBase = entitiesBaseFor(slug);

  return (
    <article
      id={entity.id}
      className="flex flex-col bg-white border border-stone-200 dark:bg-stone-900 dark:border-stone-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-stone-300 dark:hover:border-stone-700 transition-all duration-200"
    >
      {/* Name — top, centered */}
      <header className="px-4 pt-4 pb-2 text-center">
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
          {entity.name}
        </h2>
      </header>

      {/* Portrait — fixed aspect, centered; placeholder when no image */}
      <div className="px-4 flex justify-center">
        <div className="relative w-full max-w-[160px] aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-200/50 dark:ring-stone-700/50 flex items-center justify-center">
          {!imageError ? (
            <Image
              src={`${entitiesBase}/${entity.id}.webp`}
              alt=""
              fill
              className="object-cover object-top"
              sizes="160px"
              onError={() => setImageError(true)}
            />
          ) : (
            <svg
              className="w-12 h-12 text-stone-400 dark:text-stone-500 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
      </div>

      {/* Description + first appearance */}
      <div className="flex-1 px-4 pb-4 flex flex-col gap-3">
        {entity.spoilerFreeIntro && (
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed text-center">
            {entity.spoilerFreeIntro}
          </p>
        )}
        {firstAppearance && (
          <Link
            href={`/book/${slug}/chapter/${firstAppearance.number}?scrollTo=${encodeURIComponent(entity.id)}`}
            className="mt-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200 hover:bg-amber-500/25 dark:hover:bg-amber-400/30 border border-amber-300/50 dark:border-amber-500/40 transition-colors"
            title={`Chapter ${firstAppearance.number}: ${firstAppearance.title}`}
          >
            <span className="shrink-0 size-4 rounded-full bg-amber-500/30 dark:bg-amber-400/40 flex items-center justify-center text-[10px] font-bold text-amber-800 dark:text-amber-100">
              {firstAppearance.number}
            </span>
            First appears in Chapter {firstAppearance.number}
            <span className="text-amber-600 dark:text-amber-300" aria-hidden>
              →
            </span>
          </Link>
        )}
      </div>
    </article>
  );
}
