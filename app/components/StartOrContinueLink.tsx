"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { TOTAL_CHAPTERS, LAST_CHAPTER_STORAGE_KEY } from "@/lib/constants";

const linkClassName =
  "inline-flex items-center gap-2 px-6 py-2.5 bg-stone-800 text-white rounded-full text-sm font-medium hover:bg-stone-700 transition-colors";

function getSnapshot(): { href: string; label: string } {
  if (typeof window === "undefined") {
    return { href: "/chapter/1", label: "Start Reading" };
  }
  try {
    const raw = window.localStorage.getItem(LAST_CHAPTER_STORAGE_KEY);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isNaN(n) || n < 1 || n > TOTAL_CHAPTERS || n === 1) {
      return { href: "/chapter/1", label: "Start Reading" };
    }
    return { href: `/chapter/${n}`, label: "Continue Reading" };
  } catch {
    return { href: "/chapter/1", label: "Start Reading" };
  }
}

function subscribe() {
  return () => {};
}

export function StartOrContinueLink() {
  const { href, label } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => ({ href: "/chapter/1", label: "Start Reading" })
  );

  return (
    <Link href={href} className={linkClassName}>
      {label}
    </Link>
  );
}
