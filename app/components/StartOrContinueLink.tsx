"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { TOTAL_CHAPTERS, LAST_CHAPTER_STORAGE_KEY } from "@/lib/constants";

const linkClassName =
  "inline-flex items-center gap-2 px-6 py-2.5 bg-stone-800 text-white rounded-full text-sm font-medium hover:bg-stone-700 dark:bg-amber-400 dark:text-stone-950 dark:hover:bg-amber-300 transition-colors";

const SERVER_SNAPSHOT = { href: "/chapter/1", label: "Start Reading" } as const;

const startSnapshot = { href: "/chapter/1", label: "Start Reading" };
const continueSnapshotByChapter: Record<number, { href: string; label: string }> = {};

function getSnapshot(): { href: string; label: string } {
  if (typeof window === "undefined") {
    return SERVER_SNAPSHOT;
  }
  try {
    const raw = window.localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(n) || n < 1 || n > TOTAL_CHAPTERS || n === 1) {
      return startSnapshot;
    }
    if (!continueSnapshotByChapter[n]) {
      continueSnapshotByChapter[n] = {
        href: `/chapter/${n}`,
        label: "Continue Reading",
      };
    }
    return continueSnapshotByChapter[n];
  } catch {
    return startSnapshot;
  }
}

function subscribe() {
  return () => {};
}

export function StartOrContinueLink() {
  const { href, label } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT
  );

  return (
    <Link href={href} className={linkClassName}>
      {label}
    </Link>
  );
}
