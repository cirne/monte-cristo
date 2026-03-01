"use client";

import { usePathname } from "next/navigation";
import { TOTAL_CHAPTERS } from "@/lib/constants";

export function HeaderProgressBar() {
  const pathname = usePathname();
  const match = pathname?.match(/^\/chapter\/(\d+)\/?$/);
  const chapterNum = match ? parseInt(match[1], 10) : null;
  const progress =
    chapterNum != null && chapterNum >= 1 && chapterNum <= TOTAL_CHAPTERS
      ? Math.round((chapterNum / TOTAL_CHAPTERS) * 100)
      : null;

  return (
    <div className="h-0.5 w-full bg-stone-200">
      {progress != null ? (
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      ) : null}
    </div>
  );
}
