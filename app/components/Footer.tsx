"use client";

import { usePathname } from "next/navigation";
import { useMemo, useEffect, useState } from "react";

interface BookInfo {
  title: string;
  author: string;
  license: string;
  source: string;
  sourceUrl: string | null;
}

function parseBookSlug(pathname: string): string | null {
  const match = pathname.match(/^\/book\/([^/]+)/);
  return match ? match[1] : null;
}

export function Footer() {
  const pathname = usePathname();
  const slug = useMemo(() => parseBookSlug(pathname ?? ""), [pathname]);
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);

  useEffect(() => {
    if (!slug) {
      queueMicrotask(() => setBookInfo(null));
      return;
    }
    let cancelled = false;
    fetch(`/api/book-info?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.title && data?.author) {
          setBookInfo({
            title: data.title,
            author: data.author,
            license: data.license ?? "Public Domain",
            source: data.source ?? "",
            sourceUrl: data.sourceUrl ?? null,
          });
        } else {
          setBookInfo(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBookInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const linkClass =
    "underline text-stone-500 hover:text-stone-700 dark:text-stone-300 dark:hover:text-stone-100";

  return (
    <footer className="border-t border-stone-200 mt-16 py-6 text-center text-xs text-stone-400 dark:border-stone-800 dark:text-stone-500">
      {bookInfo ? (
        <>
          <p>
            <em>{bookInfo.title}</em> by {bookInfo.author} — {bookInfo.license}
          </p>
          {bookInfo.sourceUrl ? (
            <p className="mt-1">
              Source:{" "}
              <a
                href={bookInfo.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {bookInfo.source.includes("Project Gutenberg")
                  ? "Project Gutenberg"
                  : bookInfo.source.replace(/\s*\(https?:\/\/[^)]+\)\s*$/, "").trim() || bookInfo.sourceUrl}
              </a>
            </p>
          ) : bookInfo.source ? (
            <p className="mt-1">Source: {bookInfo.source}</p>
          ) : null}
        </>
      ) : (
        <p>Public domain texts from Project Gutenberg.</p>
      )}
    </footer>
  );
}
