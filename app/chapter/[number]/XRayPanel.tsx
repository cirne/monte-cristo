"use client";

import React from "react";
import Image from "next/image";
import type { EntityType } from "@/lib/chapter-index";
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
}

export function XRayPanel({
  entityId,
  entityData,
  chapterNumber,
  baselineIntro,
  onClose,
  onSelectEntity,
}: XRayPanelProps) {
  const [imageError, setImageError] = React.useState(false);
  React.useEffect(() => setImageError(false), [entityId]);

  if (!entityId) return null;

  const data = entityData[entityId];
  if (!data) return null;

  const isFirstChapter = chapterNumber === 1;
  const introText = data.spoilerFreeIntro ?? data.name;
  const introSegments =
    onSelectEntity && Object.keys(entityData).length > 1
      ? parseTextForEntityLinks(introText, entityData, entityId)
      : [{ type: "text" as const, content: introText }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-stone-200 dark:bg-stone-900 dark:border-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{data.name}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 p-1 -m-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Entity portrait when image exists (convention: /images/entities/{id}.webp) */}
          <div className="flex justify-center mb-4">
            {!imageError && (
              <div className="rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 w-52 h-64 flex-shrink-0 relative">
                <Image
                  src={`/images/entities/${entityId}.webp`}
                  alt=""
                  fill
                  className="object-cover object-top"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
          </div>

          {data.aliases.length > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
              Also known as: {data.aliases.join(", ")}
            </p>
          )}

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

          <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
            First appears in Chapter {data.firstSeenInChapter}
          </p>

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
      </div>
    </div>
  );
}
