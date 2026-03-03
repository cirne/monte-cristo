"use client";

import React from "react";

type Mode = "idle" | "loading" | "result" | "error";

interface SummaryButtonProps {
  label: string;
  dialogLabel: string;
  endpoint: string;
  chapterNumber: number;
  bookSlug: string;
  paragraphIndex: number;
}

export function SummaryButton({
  label,
  dialogLabel,
  endpoint,
  chapterNumber,
  bookSlug,
  paragraphIndex,
}: SummaryButtonProps) {
  const requestIdRef = React.useRef(0);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [answer, setAnswer] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const isOpen = mode === "loading" || mode === "result" || mode === "error";

  const close = React.useCallback(() => {
    requestIdRef.current += 1;
    setMode("idle");
    setAnswer(undefined);
    setError(undefined);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const handleClick = React.useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setMode("loading");
    setAnswer(undefined);
    setError(undefined);

    const loadingStartedAt = Date.now();
    const MIN_LOADING_MS = 400;

    try {
      const url = `${endpoint}?chapter=${chapterNumber}&paragraph=${paragraphIndex}&book=${encodeURIComponent(bookSlug)}`;
      const response = await fetch(url);
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (requestIdRef.current !== requestId) return;
      if (!response.ok) throw new Error(payload.error ?? "Unable to load summary.");
      const text = payload.answer?.trim();
      if (!text) throw new Error("Summary response was empty.");
      const elapsed = Date.now() - loadingStartedAt;
      const delay = Math.max(0, MIN_LOADING_MS - elapsed);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (requestIdRef.current !== requestId) return;
      setMode("result");
      setAnswer(text);
    } catch (e) {
      const elapsed = Date.now() - loadingStartedAt;
      const delay = Math.max(0, MIN_LOADING_MS - elapsed);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (requestIdRef.current !== requestId) return;
      setMode("error");
      setError(e instanceof Error ? e.message : "Unable to load summary.");
    }
  }, [endpoint, chapterNumber, paragraphIndex, bookSlug]);

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="text-sm text-amber-700 dark:text-amber-500 hover:text-amber-900 dark:hover:text-amber-300 hover:underline underline-offset-2 cursor-pointer bg-transparent border-none p-0"
      >
        {label}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={close}
        >
          <div
            role="dialog"
            aria-label={dialogLabel}
            className="bg-white dark:bg-stone-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] min-h-[200px] overflow-y-auto border border-stone-200 dark:border-stone-700 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {mode === "loading" && (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <div
                  className="size-10 rounded-full border-2 border-stone-200 border-t-amber-600 animate-spin"
                  aria-hidden
                />
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">{dialogLabel}</p>
                  <p className="text-sm text-stone-700 dark:text-stone-300">Preparing your summary…</p>
                </div>
              </div>
            )}

            {mode === "result" && (
              <div className="p-3">
                <p className="text-xs uppercase tracking-widest text-stone-400 mb-3">{dialogLabel}</p>
                <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                  {answer}
                </p>
                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {mode === "error" && (
              <div className="p-3">
                <p className="text-xs uppercase tracking-widest text-red-400 mb-1">Summary unavailable</p>
                <p className="text-sm text-stone-700 dark:text-stone-300">{error}</p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleClick()}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="px-2.5 py-1.5 text-xs rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200"
                  >
                    Close
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
