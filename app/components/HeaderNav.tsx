"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";
import { HeaderProgressBar } from "./HeaderProgressBar";

function parseBookChapter(pathname: string | null): { slug: string; chapterNum: number } | null {
  if (!pathname) return null;
  const bookMatch = pathname.match(/^\/book\/([^/]+)\/chapter\/(\d+)\/?$/);
  if (bookMatch) {
    const chapterNum = parseInt(bookMatch[2], 10);
    return Number.isNaN(chapterNum) ? null : { slug: bookMatch[1], chapterNum };
  }
  const legacyMatch = pathname.match(/^\/chapter\/(\d+)\/?$/);
  if (legacyMatch) {
    const chapterNum = parseInt(legacyMatch[1], 10);
    return Number.isNaN(chapterNum) ? null : { slug: DEFAULT_BOOK_SLUG, chapterNum };
  }
  return null;
}


interface BookInfo {
  title: string;
  totalChapters: number;
  storageKey: string;
}

export function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const parsed = parseBookChapter(pathname);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);

  const slug = parsed?.slug ?? null;
  const chapterNum = parsed?.chapterNum ?? null;
  const totalChapters = bookInfo?.totalChapters ?? 0;
  const prev = chapterNum != null && chapterNum > 1 ? chapterNum - 1 : null;
  const next =
    chapterNum != null && totalChapters > 0 && chapterNum < totalChapters ? chapterNum + 1 : null;
  const showBack = pathname && pathname !== "/";

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/api/book-info?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBookInfo({
          title: data.title,
          totalChapters: data.totalChapters ?? 0,
          storageKey: data.storageKey ?? "",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (chapterNum != null && bookInfo?.storageKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(bookInfo.storageKey, String(chapterNum));
      } catch {
        // ignore
      }
    }
  }, [chapterNum, bookInfo?.storageKey]);

  const homeHref = slug ? `/book/${slug}` : "/";
  const titleLabel = bookInfo?.title ?? "Monte Cristo Reader";

  if (pathname === "/") return null;

  return (
    <header className="border-stone-200 bg-white sticky top-0 z-10 dark:border-stone-800 dark:bg-stone-900">
    <nav className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-6 text-sm w-full border-b border-stone-200 dark:border-stone-800">
      <div className="flex items-center gap-4 sm:gap-6">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors p-1 -m-1"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <Link
          href="/"
          className="hidden sm:flex items-center gap-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          aria-label="Home"
        >
          <Home className="size-5 shrink-0" aria-hidden />
          <span>Library</span>
        </Link>
        <Link
          href={homeHref}
          className="flex items-center gap-2 font-semibold text-stone-800 hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300"
          aria-label={titleLabel}
        >
          {titleLabel}
        </Link>
      </div>
      {slug && chapterNum != null ? (
        <div className="flex items-center text-stone-600 dark:text-stone-300">
          {prev ? (
            <Link
              href={`/book/${slug}/chapter/${prev}`}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              aria-label={`Chapter ${prev}`}
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="text-stone-300 dark:text-stone-700 cursor-default" aria-hidden>
              <ChevronLeft className="size-5" />
            </span>
          )}
          <Link
            href={`/book/${slug}`}
            className="font-medium text-stone-800 tabular-nums min-w-[2rem] text-center hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300 transition-colors block"
            aria-label="Book home"
          >
            <span className="hidden sm:inline">Ch. </span>{chapterNum}
          </Link>
          {next ? (
            <Link
              href={`/book/${slug}/chapter/${next}`}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              aria-label={`Chapter ${next}`}
            >
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="text-stone-300 dark:text-stone-700 cursor-default" aria-hidden>
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
    <HeaderProgressBar />
    </header>
  );
}
