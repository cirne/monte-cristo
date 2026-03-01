"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOTAL_CHAPTERS } from "@/lib/constants";
import { BookOpen, List, Search, ChevronLeft, ChevronRight } from "lucide-react";

export function HeaderNav() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/chapter\/(\d+)\/?$/);
  const chapterNum = match ? parseInt(match[1], 10) : null;
  const prev = chapterNum != null && chapterNum > 1 ? chapterNum - 1 : null;
  const next =
    chapterNum != null && chapterNum < TOTAL_CHAPTERS ? chapterNum + 1 : null;

  return (
    <nav className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-6 text-sm w-full">
      <div className="flex items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-stone-800 hover:text-stone-600"
          aria-label="The Count of Monte Cristo"
        >
          <BookOpen className="size-5 shrink-0 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">The Count of Monte Cristo</span>
        </Link>
        <Link
          href="/chapters"
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700"
          aria-label="Table of Contents"
        >
          <List className="size-5 shrink-0 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Table of Contents</span>
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700"
          aria-label="Search"
        >
          <Search className="size-5 shrink-0 sm:hidden" aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </Link>
      </div>
      {chapterNum != null ? (
        <div className="flex items-center gap-3 text-stone-600">
          {prev ? (
            <Link
              href={`/chapter/${prev}`}
              className="hover:text-stone-900 transition-colors"
              aria-label={`Chapter ${prev}`}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="text-stone-300 cursor-default" aria-hidden>
              <ChevronLeft className="size-5" />
            </span>
          )}
          <span className="font-medium text-stone-800 tabular-nums min-w-[3rem] text-center">
            Ch. {chapterNum}
          </span>
          {next ? (
            <Link
              href={`/chapter/${next}`}
              className="hover:text-stone-900 transition-colors"
              aria-label={`Chapter ${next}`}
            >
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="text-stone-300 cursor-default" aria-hidden>
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
