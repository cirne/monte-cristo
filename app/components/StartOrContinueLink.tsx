"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getBookConfig } from "@/lib/books";

const linkClassName =
  "inline-flex items-center gap-2 px-6 py-2.5 bg-stone-800 text-white rounded-full text-sm font-medium hover:bg-stone-700 dark:bg-amber-400 dark:text-stone-950 dark:hover:bg-amber-300 transition-colors";

const DEFAULT_SLUG = "monte-cristo";

const continueSnapshotCache: Record<string, Record<number, { href: string; label: string }>> = {};
const startSnapshotCache: Record<string, { href: string; label: string }> = {};

function getSnapshot(bookSlug: string): { href: string; label: string } {
  const config = getBookConfig(bookSlug);
  const storageKey = config?.storageKey ?? "monte-cristo-last-chapter";
  const baseHref = `/book/${bookSlug}/chapter`;
  const startSnapshot = (() => {
    if (!startSnapshotCache[bookSlug]) {
      startSnapshotCache[bookSlug] = {
        href: `${baseHref}/1`,
        label: "Start Reading",
      };
    }
    return startSnapshotCache[bookSlug];
  })();

  if (typeof window === "undefined") {
    return startSnapshot;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(n) || n < 1 || n === 1) {
      return startSnapshot;
    }
    if (!continueSnapshotCache[bookSlug]) continueSnapshotCache[bookSlug] = {};
    if (!continueSnapshotCache[bookSlug][n]) {
      continueSnapshotCache[bookSlug][n] = {
        href: `${baseHref}/${n}`,
        label: "Continue Reading",
      };
    }
    return continueSnapshotCache[bookSlug][n];
  } catch {
    return startSnapshot;
  }
}

function subscribe() {
  return () => {};
}

export function StartOrContinueLink({
  bookSlug = DEFAULT_SLUG,
}: {
  /** When provided, links and localStorage use this book (e.g. on /book/[slug] home). */
  bookSlug?: string;
}) {
  const slug = bookSlug || DEFAULT_SLUG;
  const serverSnapshot =
    startSnapshotCache[slug] ?? {
      href: `/book/${slug}/chapter/1`,
      label: "Start Reading",
    };
  const { href, label } = useSyncExternalStore(
    subscribe,
    () => getSnapshot(slug),
    () => serverSnapshot
  );

  return (
    <Link href={href} className={linkClassName}>
      {label}
    </Link>
  );
}
