"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function parseChapterPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const bookMatch = pathname.match(/^\/book\/([^/]+)\/chapter\/(\d+)\/?$/);
  if (bookMatch) return pathname;
  const legacyMatch = pathname.match(/^\/chapter\/(\d+)\/?$/);
  if (legacyMatch) return pathname;
  return null;
}

function getParagraphIndex(node: Element): number | null {
  const raw = node.getAttribute("data-paragraph-index");
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getLargestVisibleParagraphIndex(paragraphs: HTMLElement[]): number {
  let maxVisible = -1;
  for (const paragraph of paragraphs) {
    const rect = paragraph.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      const index = getParagraphIndex(paragraph);
      if (index != null && index > maxVisible) maxVisible = index;
    }
  }
  return maxVisible;
}

function isChapterEndVisible(lastParagraph: HTMLElement): boolean {
  const rect = lastParagraph.getBoundingClientRect();

  // JSDOM returns all zeros for layout metrics. In that environment,
  // don't auto-force 100% because it would mask normal paragraph progress logic.
  if (rect.top === 0 && rect.bottom === 0 && rect.height === 0) return false;

  return rect.bottom <= window.innerHeight + 1;
}

export function HeaderProgressBar() {
  const pathname = usePathname();
  const chapterPath = parseChapterPath(pathname);
  const [progressState, setProgressState] = useState<{
    chapterPath: string;
    progress: number;
  } | null>(null);
  const progress =
    chapterPath == null
      ? null
      : progressState?.chapterPath === chapterPath
        ? progressState.progress
        : 0;

  useEffect(() => {
    if (chapterPath == null) return;

    let cleanupTracking: (() => void) | null = null;

    const startTracking = () => {
      if (cleanupTracking) return true;

      const paragraphNodes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-paragraph-index]")
      );
      if (paragraphNodes.length === 0) return false;

      const visibleIndices = new Set<number>();
      const totalParagraphs = paragraphNodes.length;
      const lastParagraph = paragraphNodes[totalParagraphs - 1];

      const updateProgress = (nextProgress: number) => {
        setProgressState((prev) => {
          if (prev?.chapterPath === chapterPath && prev.progress === nextProgress) {
            return prev;
          }
          return { chapterPath, progress: nextProgress };
        });
      };

      const recomputeProgress = () => {
        if (isChapterEndVisible(lastParagraph)) {
          updateProgress(100);
          return;
        }

        const maxVisible =
          visibleIndices.size > 0
            ? Math.max(...visibleIndices)
            : getLargestVisibleParagraphIndex(paragraphNodes);

        if (maxVisible < 0) {
          updateProgress(0);
          return;
        }

        const percent = Math.round(((maxVisible + 1) / totalParagraphs) * 100);
        updateProgress(Math.min(99, Math.max(0, percent)));
      };

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const index = getParagraphIndex(entry.target);
            if (index == null) continue;
            if (entry.isIntersecting) visibleIndices.add(index);
            else visibleIndices.delete(index);
          }
          recomputeProgress();
        },
        { root: null, rootMargin: "0px", threshold: 0.1 }
      );

      paragraphNodes.forEach((node) => observer.observe(node));
      window.addEventListener("scroll", recomputeProgress, { passive: true });
      window.addEventListener("resize", recomputeProgress);

      const frameId = window.requestAnimationFrame(recomputeProgress);

      cleanupTracking = () => {
        window.cancelAnimationFrame(frameId);
        observer.disconnect();
        visibleIndices.clear();
        window.removeEventListener("scroll", recomputeProgress);
        window.removeEventListener("resize", recomputeProgress);
      };

      return true;
    };

    if (startTracking()) {
      return () => cleanupTracking?.();
    }

    const mutationObserver = new MutationObserver(() => {
      if (startTracking()) mutationObserver.disconnect();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      cleanupTracking?.();
    };
  }, [chapterPath]);

  return (
    <div className="h-0.5 w-full bg-stone-200 dark:bg-stone-800">
      {progress != null ? (
        <div
          className="h-full bg-amber-500 dark:bg-amber-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      ) : null}
    </div>
  );
}
