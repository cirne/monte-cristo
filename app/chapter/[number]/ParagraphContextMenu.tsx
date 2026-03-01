"use client";

import React from "react";

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

export function ParagraphContextMenu({ anchor, chapterNumber, onClose }: ParagraphContextMenuProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const requestIdRef = React.useRef(0);
  const [mode, setMode] = React.useState<ContextPopoverMode>("menu");
  const [action, setAction] = React.useState<ContextAction | undefined>(undefined);
  const [answer, setAnswer] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);

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
    if (!anchor) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
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
  }, [anchor, closeMenu]);

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
        const url = `${actionEndpoint(nextAction)}?chapter=${chapterNumber}&paragraph=${anchor.paragraphIndex}`;
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
    [anchor, chapterNumber]
  );

  if (!anchor) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Reading context menu"
        className="pointer-events-auto fixed w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white shadow-xl"
        style={{
          left: anchor.x,
          top: anchor.y,
          transform: "translateX(-50%)",
        }}
      >
        {mode === "menu" && (
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

        {mode === "loading" && (
          <div className="p-3">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
              {actionLabel(action ?? "current-scene")}
            </p>
            <p className="text-sm text-stone-700">Loading context…</p>
          </div>
        )}

        {mode === "result" && (
          <div className="p-3">
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">
              {actionLabel(action ?? "current-scene")}
            </p>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{answer}</p>
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
                Menu
              </button>
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
  );
}
