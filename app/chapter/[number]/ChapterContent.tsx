"use client";

import React from "react";
import type { Segment } from "@/lib/linkify";
import type { SceneWithDetails } from "@/lib/scenes";
import { XRayPanel } from "./XRayPanel";
import type { XRayEntityData } from "./XRayPanel";
import { ReaderFooter } from "./ReaderFooter";

export interface ChapterContentProps {
  paragraphSegments: Segment[][];
  /** Scenes from chapter index (SceneWithDetails[]): startParagraph determines where each scene image is shown. */
  scenes: SceneWithDetails[];
  chapterNumber: number;
  xrayData: Record<string, XRayEntityData>;
  baselineIntro?: string;
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
}: ChapterContentProps) {
  const [openEntityId, setOpenEntityId] = React.useState<string | null>(null);
  const articleRef = React.useRef<HTMLDivElement>(null);
  const [visibleParagraphIndices, setVisibleParagraphIndices] = React.useState<Set<number>>(() => new Set());

  /** Track which paragraphs intersect the viewport; current scene = earliest scene that overlaps any visible paragraph. */
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
  }, [paragraphSegments.length]);

  /** Earliest scene (by startParagraph) that contains at least one visible paragraph. */
  const currentScene = React.useMemo(() => {
    if (visibleParagraphIndices.size === 0 || !scenes?.length) return null;
    const visible = Array.from(visibleParagraphIndices);
    const overlapping = scenes
      .filter((s) => visible.some((i) => i >= s.startParagraph && i <= s.endParagraph))
      .sort((a, b) => a.startParagraph - b.startParagraph);
    return overlapping[0] ?? null;
  }, [scenes, visibleParagraphIndices]);

  /** Character entity IDs linked in the visible paragraphs (order: alphabetical by id). */
  const visibleCharacterIds = React.useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    const sortedIndices = Array.from(visibleParagraphIndices).sort((a, b) => a - b);
    for (const i of sortedIndices) {
      const segments = paragraphSegments[i];
      if (!segments) continue;
      for (const seg of segments) {
        if (seg.type === "link" && seg.entityType === "person" && !seen.has(seg.entityId)) {
          seen.add(seg.entityId);
          ids.push(seg.entityId);
        }
      }
    }
    return ids.sort((a, b) => a.localeCompare(b));
  }, [paragraphSegments, visibleParagraphIndices]);

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

  return (
    <>
      <div ref={articleRef} className="prose prose-stone prose-xl max-w-none pb-20">
        {paragraphSegments.map((segments, i) => (
          <React.Fragment key={i}>
            {sceneKeyByParagraphStart[i] != null && (
              <figure className="my-6 -mx-2 rounded-lg overflow-hidden">
                <img
                  src={`/images/scenes/${sceneKeyByParagraphStart[i]}.webp`}
                  alt=""
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
              className={
                isPlaceholderParagraph(segments)
                  ? "text-xl leading-relaxed text-stone-800 mb-0 min-h-0 overflow-hidden"
                  : "text-xl mb-4 leading-relaxed text-stone-800"
              }
            >
            {segments.map((seg, j) =>
              seg.type === "text" ? (
                <React.Fragment key={j}>{seg.content}</React.Fragment>
              ) : (
                <button
                  key={j}
                  type="button"
                  onClick={() => setOpenEntityId(seg.entityId)}
                  className="text-amber-700 hover:text-amber-800 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
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
      />
      <ReaderFooter
        locationLabel={currentScene?.locationDescription ?? null}
        visibleCharacterIds={visibleCharacterIds}
        xrayData={xrayData}
        onOpenEntity={setOpenEntityId}
      />
    </>
  );
}
