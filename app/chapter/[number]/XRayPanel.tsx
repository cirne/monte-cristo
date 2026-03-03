"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import type { EntityType } from "@/lib/chapter-index";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";
import { AppDrawer } from "@/app/components/AppDrawer";
import { parseTextForEntityLinks } from "./entityTextSegments";

export interface XRayEntityData {
  name: string;
  aliases: string[];
  spoilerFreeIntro?: string;
  firstSeenInChapter: number;
  excerpt?: string;
  type: EntityType;
}

interface XRayPanelProps {
  entityId: string | null;
  entityData: Record<string, XRayEntityData>;
  chapterNumber: number;
  baselineIntro?: string;
  onClose: () => void;
  onSelectEntity?: (entityId: string) => void;
  /** When set (e.g. from /book/[slug]/chapter), entity images load from /images/entities/<bookSlug>/. */
  bookSlug?: string;
}

export function XRayPanel({
  entityId,
  entityData,
  chapterNumber,
  baselineIntro,
  onClose,
  onSelectEntity,
  bookSlug,
}: XRayPanelProps) {
  const [imageError, setImageError] = React.useState(false);
  React.useEffect(() => setImageError(false), [entityId]);

  if (!entityId) return null;

  const data = entityData[entityId];
  if (!data) return null;

  const entitiesBase = `/images/entities/${bookSlug ?? DEFAULT_BOOK_SLUG}`;

  const isFirstChapter = chapterNumber === 1;
  const introText = data.spoilerFreeIntro ?? data.name;
  const introSegments =
    onSelectEntity && Object.keys(entityData).length > 1
      ? parseTextForEntityLinks(introText, entityData, entityId)
      : [{ type: "text" as const, content: introText }];

  return (
    <AppDrawer
      open={true}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      ariaLabel={data.name}
      title={data.name}
      contentClassName="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto rounded-xl"
    >
      <div className="px-5 pb-5">
        <div className="flex items-start justify-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100 text-center">
            {data.name}
          </h3>
        </div>

        {/* Entity portrait when image exists (convention: /images/entities/<book>/{id}.webp) */}
        <div className="flex justify-center mb-4">
          {!imageError && (
            <div className="rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 w-52 h-64 flex-shrink-0 relative">
              <Image
                src={`${entitiesBase}/${entityId}.webp`}
                alt=""
                fill
                className="object-cover object-top"
                onError={() => setImageError(true)}
              />
            </div>
          )}
        </div>

        <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed mb-3">
          {introSegments.map((seg, idx) =>
            seg.type === "text" ? (
              <React.Fragment key={idx}>{seg.content}</React.Fragment>
            ) : (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectEntity?.(seg.entityId)}
                className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
              >
                {seg.content}
              </button>
            )
          )}
        </p>

        {isFirstChapter && baselineIntro && (
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 italic">{baselineIntro}</p>
        )}

        {chapterNumber !== data.firstSeenInChapter && (
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
            <Link
              href={`/book/${bookSlug ?? DEFAULT_BOOK_SLUG}/chapter/${data.firstSeenInChapter}?scrollTo=${encodeURIComponent(entityId)}`}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline"
            >
              First appears in Chapter {data.firstSeenInChapter}
            </Link>
          </p>
        )}

        {data.excerpt && (
          <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
              In this chapter
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-400 italic">
              &ldquo;{data.excerpt}&rdquo;
            </p>
          </div>
        )}
      </div>
    </AppDrawer>
  );
}
