"use client";

import React from "react";
import Image from "next/image";
import type { Segment } from "@/lib/linkify";
import type { SceneWithDetails } from "@/lib/scenes";
import { XRayPanel } from "./XRayPanel";
import type { XRayEntityData } from "./XRayPanel";
import { ReaderFooter } from "./ReaderFooter";

type ContextAction = "current-scene" | "story-so-far";
type ContextPopoverMode = "menu" | "loading" | "result" | "error";

interface ContextPopoverState {
  x: number;
  y: number;
  paragraphIndex: number;
  mode: ContextPopoverMode;
  action?: ContextAction;
  answer?: string;
  error?: string;
}

function actionLabel(action: ContextAction): string {
  return action === "current-scene" ? "Current scene" : "Story so far";
}

function actionButtonLabel(action: ContextAction): string {
  return action === "current-scene" ? "Explain current scene" : "Summarize story so far";
}

function actionEndpoint(action: ContextAction): string {
  return action === "current-scene" ? "/api/context/current-scene" : "/api/context/story-so-far";
}

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
  const [contextPopover, setContextPopover] = React.useState<ContextPopoverState | null>(null);
  const contextPopoverRef = React.useRef<HTMLDivElement>(null);
  const contextRequestIdRef = React.useRef(0);

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

  /** Character entity IDs whose link is actually in the viewport (only these get footer avatars). */
  const [visibleCharacterIds, setVisibleCharacterIds] = React.useState<string[]>([]);
  const visibilityByElementRef = React.useRef<Map<Element, string>>(new Map());

  React.useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const personLinks = el.querySelectorAll<HTMLElement>("[data-person-entity-id]");
    const visibilityMap = visibilityByElementRef.current;
    if (personLinks.length === 0) {
      setVisibleCharacterIds([]);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-person-entity-id");
          if (!id) continue;
          if (entry.isIntersecting) visibilityMap.set(entry.target, id);
          else visibilityMap.delete(entry.target);
        }
        setVisibleCharacterIds(() => {
          const next = Array.from(visibilityMap.values());
          const deduped = [...new Set(next)];
          return deduped.length === 0 ? [] : deduped.sort((a, b) => a.localeCompare(b));
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );
    personLinks.forEach((link) => observer.observe(link));
    return () => {
      observer.disconnect();
      visibilityMap.clear();
      setVisibleCharacterIds([]);
    };
  }, [paragraphSegments]);

  React.useEffect(() => {
    if (!contextPopover) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (contextPopoverRef.current?.contains(target)) return;
      setContextPopover(null);
      contextRequestIdRef.current += 1;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setContextPopover(null);
      contextRequestIdRef.current += 1;
    };
    const onScroll = () => {
      setContextPopover(null);
      contextRequestIdRef.current += 1;
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [contextPopover]);

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

      contextRequestIdRef.current += 1;
      setContextPopover({
        x: clampedX,
        y: clampedY,
        paragraphIndex,
        mode: "menu",
      });
    },
    [paragraphSegments]
  );

  const runContextAction = React.useCallback(
    async (action: ContextAction) => {
      if (!contextPopover) return;
      const requestId = contextRequestIdRef.current + 1;
      contextRequestIdRef.current = requestId;
      const anchor = {
        x: contextPopover.x,
        y: contextPopover.y,
        paragraphIndex: contextPopover.paragraphIndex,
      };
      setContextPopover({
        ...anchor,
        mode: "loading",
        action,
      });

      try {
        const url = `${actionEndpoint(action)}?chapter=${chapterNumber}&paragraph=${anchor.paragraphIndex}`;
        const response = await fetch(url);
        const payload = (await response.json()) as { answer?: string; error?: string };
        if (contextRequestIdRef.current !== requestId) return;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load reading context.");
        }
        const answer = payload.answer?.trim();
        if (!answer) {
          throw new Error("Context response was empty.");
        }
        setContextPopover({
          ...anchor,
          mode: "result",
          action,
          answer,
        });
      } catch (e) {
        if (contextRequestIdRef.current !== requestId) return;
        const error = e instanceof Error ? e.message : "Unable to load reading context.";
        setContextPopover({
          ...anchor,
          mode: "error",
          action,
          error,
        });
      }
    },
    [chapterNumber, contextPopover]
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

  return (
    <>
      <div ref={articleRef} className="prose prose-stone prose-xl max-w-none pb-20">
        {paragraphSegments.map((segments, i) => (
          <React.Fragment key={i}>
            {sceneKeyByParagraphStart[i] != null && (
              <figure className="my-6 -mx-2 rounded-lg overflow-hidden">
                <Image
                  src={`/images/scenes/${sceneKeyByParagraphStart[i]}.webp`}
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
                  data-entity-link="true"
                  {...(seg.entityType === "person" ? { "data-person-entity-id": seg.entityId } : {})}
                  onClick={() => {
                    setContextPopover(null);
                    contextRequestIdRef.current += 1;
                    setOpenEntityId(seg.entityId);
                  }}
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

      {contextPopover && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div
            ref={contextPopoverRef}
            role="dialog"
            aria-label="Reading context menu"
            className="pointer-events-auto fixed w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white shadow-xl"
            style={{
              left: contextPopover.x,
              top: contextPopover.y,
              transform: "translateX(-50%)",
            }}
          >
            {contextPopover.mode === "menu" && (
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => void runContextAction("current-scene")}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-stone-700 hover:bg-amber-50 hover:text-amber-900"
                >
                  {actionButtonLabel("current-scene")}
                </button>
                <button
                  type="button"
                  onClick={() => void runContextAction("story-so-far")}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-stone-700 hover:bg-amber-50 hover:text-amber-900"
                >
                  {actionButtonLabel("story-so-far")}
                </button>
              </div>
            )}

            {contextPopover.mode === "loading" && (
              <div className="p-3">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
                  {actionLabel(contextPopover.action ?? "current-scene")}
                </p>
                <p className="text-sm text-stone-700">Loading context…</p>
              </div>
            )}

            {contextPopover.mode === "result" && (
              <div className="p-3">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
                  {actionLabel(contextPopover.action ?? "current-scene")}
                </p>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                  {contextPopover.answer}
                </p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setContextPopover((prev) =>
                        prev ? { ...prev, mode: "menu", answer: undefined, error: undefined } : prev
                      )
                    }
                    className="px-2.5 py-1.5 text-xs rounded-md border border-stone-300 text-stone-600 hover:bg-stone-50"
                  >
                    Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContextPopover(null);
                      contextRequestIdRef.current += 1;
                    }}
                    className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 text-white hover:bg-stone-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {contextPopover.mode === "error" && (
              <div className="p-3">
                <p className="text-xs uppercase tracking-widest text-red-400 mb-1">Context unavailable</p>
                <p className="text-sm text-stone-700">{contextPopover.error}</p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setContextPopover((prev) =>
                        prev ? { ...prev, mode: "menu", answer: undefined, error: undefined } : prev
                      )
                    }
                    className="px-2.5 py-1.5 text-xs rounded-md border border-stone-300 text-stone-600 hover:bg-stone-50"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
