"use client";

import React from "react";
import { LinkifiedText } from "./LinkifiedText";
import type { EntityTextSegment } from "./entityTextSegments";

interface SummaryDialogContentProps {
  title: string;
  segments: EntityTextSegment[];
  onEntityClick?: (entityId: string) => void;
  onClose: () => void;
  mode: "idle" | "loading" | "result" | "error";
  error?: string;
  onRetry?: () => void;
}

export function SummaryDialogContent({
  title,
  segments,
  onEntityClick,
  onClose,
  mode,
  error,
  onRetry,
}: SummaryDialogContentProps) {
  if (mode === "idle") {
    return null;
  }

  if (mode === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <div
          className="size-10 rounded-full border-2 border-stone-200 border-t-amber-600 animate-spin"
          aria-hidden
        />
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">{title}</p>
          <p className="text-sm text-stone-700 dark:text-stone-300">Preparing your summary…</p>
        </div>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="p-3">
        <p className="text-xs uppercase tracking-widest text-red-400 mb-1">
          {title.includes("Story so far") ? "Summary unavailable" : "Context unavailable"}
        </p>
        <p className="text-sm text-stone-700 dark:text-stone-300">{error}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1.5 text-xs rounded-md border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">{title}</p>
      <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
        <LinkifiedText segments={segments} onEntityClick={onEntityClick} />
      </p>
      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
