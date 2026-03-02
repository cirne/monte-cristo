"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { StartOrContinueLink } from "./StartOrContinueLink";

function getStoredChapter(storageKey: string): number | null {
  if (typeof window === "undefined" || !storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    return Number.isNaN(n) || n < 1 ? null : n;
  } catch {
    return null;
  }
}

function subscribe() {
  return () => {};
}

export function BookCardActions({
  slug,
  storageKey,
  totalChapters,
}: {
  slug: string;
  storageKey: string;
  totalChapters: number;
}) {
  const lastChapter = useSyncExternalStore(
    subscribe,
    () => getStoredChapter(storageKey),
    () => null
  );

  const showProgress = totalChapters > 0 && lastChapter != null && lastChapter >= 1;
  const progressPercent = showProgress
    ? Math.min(100, (lastChapter / totalChapters) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {showProgress ? (
        <div>
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5 tabular-nums">
            Ch. {lastChapter}
          </p>
          <div
            className="h-1.5 w-full rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={lastChapter}
            aria-valuemin={1}
            aria-valuemax={totalChapters}
            aria-label={`Progress: chapter ${lastChapter} of ${totalChapters}`}
          >
            <div
              className="h-full rounded-full bg-stone-600 dark:bg-amber-500 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/book/${slug}/chapters`}
          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:border-stone-600 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          Table of Contents
        </Link>
        <StartOrContinueLink bookSlug={slug} variant="compact" />
      </div>
    </div>
  );
}
