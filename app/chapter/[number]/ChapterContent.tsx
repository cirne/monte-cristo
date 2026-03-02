"use client";

import React from "react";
import Image from "next/image";
import type { Segment } from "@/lib/linkify";
import type { SceneWithDetails } from "@/lib/scenes";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";
import { XRayPanel } from "./XRayPanel";
import type { XRayEntityData } from "./XRayPanel";
import { ReaderFooter } from "./ReaderFooter";
import { ParagraphContextMenu, type ParagraphContextAnchor } from "./ParagraphContextMenu";

export interface ChapterContentProps {
  paragraphSegments: Segment[][];
  /** Scenes from chapter index (SceneWithDetails[]): startParagraph determines where each scene image is shown. */
  scenes: SceneWithDetails[];
  chapterNumber: number;
  xrayData: Record<string, XRayEntityData>;
  baselineIntro?: string;
  /** When set, context API requests use this book (e.g. /book/[slug]/chapter/[number]) */
  bookSlug?: string;
  /** When set, scroll to the first in-chapter link for this entity (e.g. from character guide ?scrollTo=id). */
  scrollToEntityId?: string | null;
}

/** True if this paragraph is only a placeholder (e.g. stripped PG page marker). */
function isPlaceholderParagraph(segments: Segment[]): boolean {
  const text = segments.map((s) => s.content).join("");
  return segments.length > 0 && /^[\s\u200B]*$/.test(text);
}

export function ChapterContent({
  paragraphSegments,
  scenes,
  chapterNumber,
  xrayData,
  baselineIntro,
  bookSlug,
  scrollToEntityId,
}: ChapterContentProps) {
  const [openEntityId, setOpenEntityId] = React.useState<string | null>(null);
  const articleRef = React.useRef<HTMLDivElement>(null);
  const [visibleParagraphIndices, setVisibleParagraphIndices] = React.useState<Set<number>>(() => new Set());
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<ParagraphContextAnchor | null>(null);

  /** When scrollToEntityId is set (e.g. from character guide link), scroll to the first occurrence of that entity in the chapter and run a highlight animation. */
  React.useEffect(() => {
    if (!scrollToEntityId || !articleRef.current) return;
    const id = scrollToEntityId;
    const el = articleRef.current.querySelector<HTMLElement>(
      `[data-person-entity-id="${CSS.escape(id)}"]`
    );
    if (!el) return;
    const rafId = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.setAttribute("data-scroll-to-highlight", "true");
      const onEnd = () => {
        el.removeAttribute("data-scroll-to-highlight");
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
    });
    return () => cancelAnimationFrame(rafId);
  }, [scrollToEntityId, paragraphSegments.length]);

  /** Track which paragraphs intersect the viewport; current scene = earliest scene that overlaps any visible paragraph.
   * Depends on chapterNumber so the observer is recreated when switching chapters (DOM nodes change even if paragraph count is unchanged). */
  React.useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const paragraphs = el.querySelectorAll<HTMLElement>("[data-paragraph-index]");
    if (paragraphs.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleParagraphIndices((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const idx = entry.target.getAttribute("data-paragraph-index");
            if (idx === null) continue;
            const n = parseInt(idx, 10);
            if (isNaN(n)) continue;
            if (entry.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );
    paragraphs.forEach((p) => observer.observe(p));
    return () => paragraphs.forEach((p) => observer.unobserve(p));
  }, [chapterNumber, paragraphSegments.length]);

  /** Earliest scene (by startParagraph) that contains at least one visible paragraph. */
  const currentScene = React.useMemo(() => {
    if (visibleParagraphIndices.size === 0 || !scenes?.length) return null;
    const visible = Array.from(visibleParagraphIndices);
    const overlapping = scenes
      .filter((s) => visible.some((i) => i >= s.startParagraph && i <= s.endParagraph))
      .sort((a, b) => a.startParagraph - b.startParagraph);
    return overlapping[0] ?? null;
  }, [scenes, visibleParagraphIndices]);

  /** Character entity IDs whose link is in the viewport. Re-scanned from scratch on debounced scroll/resize. */
  const [visibleCharacterIds, setVisibleCharacterIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    function scanVisibleCharacterIds(): string[] {
      if (!el) return [];
      const personLinks = el.querySelectorAll<HTMLElement>("[data-person-entity-id]");
      const viewportBottom = typeof window !== "undefined" ? window.innerHeight : 0;
      const ids: string[] = [];
      for (let i = 0; i < personLinks.length; i++) {
        const link = personLinks[i];
        const id = link.getAttribute("data-person-entity-id");
        if (!id) continue;
        const rect = link.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < viewportBottom) ids.push(id);
      }
      const deduped = [...new Set(ids)];
      return deduped.length === 0 ? [] : deduped.sort((a, b) => a.localeCompare(b));
    }

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 120;

    function onScrollOrResize() {
      if (debounceId != null) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        setVisibleCharacterIds(scanVisibleCharacterIds());
      }, DEBOUNCE_MS);
    }

    setVisibleCharacterIds(scanVisibleCharacterIds());
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (debounceId != null) clearTimeout(debounceId);
      setVisibleCharacterIds([]);
    };
  }, [chapterNumber, paragraphSegments]);

  const openContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLParagraphElement>, paragraphIndex: number) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-entity-link='true']")) return;
      if (isPlaceholderParagraph(paragraphSegments[paragraphIndex] ?? [])) return;

      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      const y = event.clientY > 0 ? event.clientY : rect.top + 16;
      const clampedX = Math.max(20, Math.min(x, window.innerWidth - 20));
      const clampedY = Math.max(12, Math.min(y + 8, window.innerHeight - 16));

      setContextMenuAnchor({
        x: clampedX,
        y: clampedY,
        paragraphIndex,
      });
    },
    [paragraphSegments]
  );

  /** Map: paragraph index -> scene image key (e.g. ch1-scene0). Matches index format: scenes[i].startParagraph -> ch{N}-scene{i}. */
  const sceneKeyByParagraphStart = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (!Array.isArray(scenes)) return map;
    scenes.forEach((scene, sceneIndex) => {
      const start = scene?.startParagraph;
      if (typeof start === "number" && start >= 0) {
        map[start] = `ch${chapterNumber}-scene${sceneIndex}`;
      }
    });
    return map;
  }, [scenes, chapterNumber]);

  /** Scene images: /images/scenes/<bookSlug>/ */
  const scenesBase = `/images/scenes/${bookSlug ?? DEFAULT_BOOK_SLUG}`;

  return (
    <>
      <div
        ref={articleRef}
        className="prose prose-stone prose-xl dark:prose-invert max-w-none pb-20"
      >
        {paragraphSegments.map((segments, i) => (
          <React.Fragment key={i}>
            {sceneKeyByParagraphStart[i] != null && (
              <figure className="my-6 -mx-2 rounded-lg overflow-hidden">
                <Image
                  src={`${scenesBase}/${sceneKeyByParagraphStart[i]}.webp`}
                  alt=""
                  width={800}
                  height={450}
                  className="w-full h-auto max-w-full"
                  onError={(e) => {
                    const fig = e.currentTarget.closest("figure");
                    if (fig) (fig as HTMLElement).style.display = "none";
                  }}
                />
              </figure>
            )}
            <p
              data-paragraph-index={i}
              onClick={(event) => openContextMenu(event, i)}
              className={
                isPlaceholderParagraph(segments)
                  ? "text-xl leading-relaxed text-stone-800 dark:text-stone-300 mb-0 min-h-0 overflow-hidden"
                  : "text-xl mb-4 leading-relaxed text-stone-800 dark:text-stone-300"
              }
            >
            {segments.map((seg, j) =>
              seg.type === "text" ? (
                <React.Fragment key={j}>{seg.content}</React.Fragment>
              ) : (
                <button
                  key={j}
                  type="button"
                  data-entity-link="true"
                  {...(seg.entityType === "person" ? { "data-person-entity-id": seg.entityId } : {})}
                  onClick={() => {
                    setContextMenuAnchor(null);
                    setOpenEntityId(seg.entityId);
                  }}
                  className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
                >
                  {seg.content}
                </button>
              )
            )}
            </p>
          </React.Fragment>
        ))}
      </div>

      <XRayPanel
        entityId={openEntityId}
        entityData={xrayData}
        chapterNumber={chapterNumber}
        baselineIntro={baselineIntro}
        onClose={() => setOpenEntityId(null)}
        onSelectEntity={setOpenEntityId}
        bookSlug={bookSlug}
      />
      <ReaderFooter
        locationLabel={currentScene?.locationDescription ?? null}
        visibleCharacterIds={visibleCharacterIds}
        xrayData={xrayData}
        onOpenEntity={setOpenEntityId}
        bookSlug={bookSlug}
      />
      <ParagraphContextMenu
        anchor={contextMenuAnchor}
        chapterNumber={chapterNumber}
        onClose={() => setContextMenuAnchor(null)}
        entityData={xrayData}
        onOpenEntity={setOpenEntityId}
        bookSlug={bookSlug}
      />
    </>
  );
}
