"use client";

import React from "react";
import type { XRayEntityData } from "./XRayPanel";
import { parseTextForEntityLinks } from "./entityTextSegments";

type ContextAction = "current-scene" | "story-so-far";
type ContextPopoverMode = "menu" | "loading" | "result" | "error";

export interface ParagraphContextAnchor {
  x: number;
  y: number;
  paragraphIndex: number;
}

interface ParagraphContextMenuProps {
  anchor: ParagraphContextAnchor | null;
  chapterNumber: number;
  onClose: () => void;
  entityData?: Record<string, XRayEntityData>;
  onOpenEntity?: (entityId: string) => void;
  /** When set, context API requests include &book= for multi-book support */
  bookSlug?: string;
}

const VIEWPORT_MARGIN_PX = 12;
const MAX_POPOVER_WIDTH_PX = 352; // 22rem
const MIN_VISIBLE_HEIGHT_PX = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

export function ParagraphContextMenu({
  anchor,
  chapterNumber,
  onClose,
  entityData = {},
  onOpenEntity,
  bookSlug,
}: ParagraphContextMenuProps) {
  const menuPopoverRef = React.useRef<HTMLDivElement>(null);
  const requestIdRef = React.useRef(0);
  const [mode, setMode] = React.useState<ContextPopoverMode>("menu");
  const [action, setAction] = React.useState<ContextAction | undefined>(undefined);
  const [answer, setAnswer] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const isSummaryDialogOpen = mode === "loading" || mode === "result" || mode === "error";

  const layout = React.useMemo(() => {
    if (!anchor || typeof window === "undefined") {
      return {
        left: anchor?.x ?? VIEWPORT_MARGIN_PX,
        top: anchor?.y ?? VIEWPORT_MARGIN_PX,
        width: MAX_POPOVER_WIDTH_PX,
        maxHeight: 400,
      };
    }

    const viewportWidth = Math.max(120, window.innerWidth);
    const viewportHeight = Math.max(120, window.innerHeight);

    const availableWidth = Math.max(120, viewportWidth - VIEWPORT_MARGIN_PX * 2);
    const width = Math.min(MAX_POPOVER_WIDTH_PX, availableWidth);
    const maxLeft = viewportWidth - VIEWPORT_MARGIN_PX - width;
    const left =
      maxLeft >= VIEWPORT_MARGIN_PX
        ? clamp(anchor.x - width / 2, VIEWPORT_MARGIN_PX, maxLeft)
        : VIEWPORT_MARGIN_PX;

    const availableHeight = Math.max(120, viewportHeight - VIEWPORT_MARGIN_PX * 2);
    const minVisibleHeight = Math.min(MIN_VISIBLE_HEIGHT_PX, availableHeight);
    const maxTop = viewportHeight - VIEWPORT_MARGIN_PX - minVisibleHeight;
    const top = maxTop >= VIEWPORT_MARGIN_PX
      ? clamp(anchor.y, VIEWPORT_MARGIN_PX, maxTop)
      : VIEWPORT_MARGIN_PX;
    const maxHeight = Math.max(120, viewportHeight - top - VIEWPORT_MARGIN_PX);

    return {
      left,
      top,
      width,
      maxHeight,
    };
  }, [anchor]);

  const closeMenu = React.useCallback(() => {
    requestIdRef.current += 1;
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!anchor) return;
    requestIdRef.current += 1;
    setMode("menu");
    setAction(undefined);
    setAnswer(undefined);
    setError(undefined);
  }, [anchor]);

  React.useEffect(() => {
    if (!anchor || mode !== "menu") return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuPopoverRef.current?.contains(target)) return;
      closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenu();
    };
    const onScroll = () => closeMenu();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, closeMenu, mode]);

  React.useEffect(() => {
    if (!anchor || !isSummaryDialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, closeMenu, isSummaryDialogOpen]);

  const runContextAction = React.useCallback(
    async (nextAction: ContextAction) => {
      if (!anchor) return;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setMode("loading");
      setAction(nextAction);
      setAnswer(undefined);
      setError(undefined);

      try {
        let url = `${actionEndpoint(nextAction)}?chapter=${chapterNumber}&paragraph=${anchor.paragraphIndex}`;
        if (bookSlug) url += `&book=${encodeURIComponent(bookSlug)}`;
        const response = await fetch(url);
        const payload = (await response.json()) as { answer?: string; error?: string };
        if (requestIdRef.current !== requestId) return;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load reading context.");
        }
        const nextAnswer = payload.answer?.trim();
        if (!nextAnswer) {
          throw new Error("Context response was empty.");
        }
        setMode("result");
        setAnswer(nextAnswer);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        setMode("error");
        setError(e instanceof Error ? e.message : "Unable to load reading context.");
      }
    },
    [anchor, chapterNumber, bookSlug]
  );

  const answerSegments = React.useMemo(() => {
    const text = answer ?? "";
    if (!text) return [];
    if (!onOpenEntity || Object.keys(entityData).length === 0) {
      return [{ type: "text" as const, content: text }];
    }
    return parseTextForEntityLinks(text, entityData);
  }, [answer, entityData, onOpenEntity]);

  if (!anchor) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {mode === "menu" && (
        <div
          ref={menuPopoverRef}
          role="dialog"
          aria-label="Reading context menu"
          className="pointer-events-auto fixed overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl"
          style={{
            left: layout.left,
            top: layout.top,
            width: layout.width,
            maxHeight: layout.maxHeight,
          }}
        >
          <div data-testid="paragraph-context-scroll" className="max-h-full overflow-y-auto overscroll-contain">
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
          </div>
        </div>
      )}

      {isSummaryDialogOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeMenu}
        >
          <div
            role="dialog"
            aria-label="Reading context summary"
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto border border-stone-200 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="paragraph-context-scroll"
          >
            {mode === "loading" && (
            <div className="p-3">
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
                {actionLabel(action ?? "current-scene")}
              </p>
              <p className="text-sm text-stone-700">Preparing your summary…</p>
            </div>
            )}

            {mode === "result" && (
            <div className="p-3">
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
                {actionLabel(action ?? "current-scene")}
              </p>
              <p className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">
                {answerSegments.map((segment, index) =>
                  segment.type === "text" ? (
                    <React.Fragment key={index}>{segment.content}</React.Fragment>
                  ) : (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        closeMenu();
                        onOpenEntity?.(segment.entityId);
                      }}
                      className="text-amber-700 hover:text-amber-800 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
                    >
                      {segment.content}
                    </button>
                  )
                )}
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeMenu}
                  className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 text-white hover:bg-stone-800"
                >
                  Close
                </button>
              </div>
            </div>
            )}

            {mode === "error" && (
            <div className="p-3">
              <p className="text-xs uppercase tracking-widest text-red-400 mb-1">Context unavailable</p>
              <p className="text-sm text-stone-700">{error}</p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("menu");
                    setError(undefined);
                    setAnswer(undefined);
                  }}
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
    </div>
  );
}
