"use client";

import React from "react";
import { AppDrawer } from "@/app/components/AppDrawer";
import type { XRayEntityData } from "./XRayPanel";
import { parseTextForEntityLinks } from "./entityTextSegments";
import { SummaryDialogContent } from "./SummaryDialogContent";

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

      const loadingStartedAt = Date.now();
      const MIN_LOADING_MS = 400; // Ensure loading indicator is visible (e.g. fast prod responses)

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
        const elapsed = Date.now() - loadingStartedAt;
        const delay = Math.max(0, MIN_LOADING_MS - elapsed);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        if (requestIdRef.current !== requestId) return;
        setMode("result");
        setAnswer(nextAnswer);
      } catch (e) {
        const elapsed = Date.now() - loadingStartedAt;
        const delay = Math.max(0, MIN_LOADING_MS - elapsed);
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
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

      <AppDrawer
        open={isSummaryDialogOpen}
        onOpenChange={(next) => {
          if (!next) closeMenu();
        }}
        ariaLabel="Reading context summary"
        title={actionLabel(action ?? "current-scene")}
        contentClassName="bg-white dark:bg-stone-900 rounded-xl shadow-xl w-full max-h-[90vh] min-h-[200px] overflow-y-auto border border-stone-200 dark:border-stone-800 p-4 sm:p-6"
      >
        <div data-testid="paragraph-context-scroll">
          {mode === "loading" && (
            <SummaryDialogContent
              title={actionLabel(action ?? "current-scene")}
              segments={[]}
              onClose={closeMenu}
              mode="loading"
            />
          )}

          {mode === "result" && (
            <SummaryDialogContent
              title={actionLabel(action ?? "current-scene")}
              segments={answerSegments}
              onEntityClick={(entityId) => {
                closeMenu();
                onOpenEntity?.(entityId);
              }}
              onClose={closeMenu}
              mode="result"
            />
          )}

          {mode === "error" && (
            <SummaryDialogContent
              title={actionLabel(action ?? "current-scene")}
              segments={[]}
              onClose={closeMenu}
              mode="error"
              error={error}
              onRetry={() => {
                setMode("menu");
                setError(undefined);
                setAnswer(undefined);
              }}
            />
          )}
        </div>
      </AppDrawer>
    </div>
  );
}
