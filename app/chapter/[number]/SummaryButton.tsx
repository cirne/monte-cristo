"use client";

import React from "react";
import { AppDrawer } from "@/app/components/AppDrawer";
import { parseTextForEntityLinks } from "./entityTextSegments";
import { SummaryDialogContent } from "./SummaryDialogContent";
import type { XRayEntityData } from "./XRayPanel";

type Mode = "idle" | "loading" | "result" | "error";

interface SummaryButtonProps {
  label: string;
  dialogLabel: string;
  endpoint: string;
  chapterNumber: number;
  bookSlug: string;
  paragraphIndex: number;
  entityData?: Record<string, XRayEntityData>;
  onOpenEntity?: (entityId: string) => void;
}

export function SummaryButton({
  label,
  dialogLabel,
  endpoint,
  chapterNumber,
  bookSlug,
  paragraphIndex,
  entityData = {},
  onOpenEntity,
}: SummaryButtonProps) {
  const requestIdRef = React.useRef(0);
  const [mode, setMode] = React.useState<Mode>("idle");
  const [answer, setAnswer] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const isOpen = mode === "loading" || mode === "result" || mode === "error";

  const answerSegments = React.useMemo(() => {
    if (!answer || Object.keys(entityData).length === 0) {
      return [{ type: "text" as const, content: answer ?? "" }];
    }
    return parseTextForEntityLinks(answer, entityData);
  }, [answer, entityData]);

  const close = React.useCallback(() => {
    requestIdRef.current += 1;
    setMode("idle");
    setAnswer(undefined);
    setError(undefined);
  }, []);

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

      <AppDrawer
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) {
            close();
          }
        }}
        ariaLabel={dialogLabel}
        title={dialogLabel}
      >
        <SummaryDialogContent
          title={dialogLabel}
          segments={answerSegments}
          onEntityClick={(entityId) => {
            onOpenEntity?.(entityId);
            close();
          }}
          onClose={close}
          mode={mode}
          error={error}
          onRetry={mode === "error" ? () => void handleClick() : undefined}
        />
      </AppDrawer>
    </>
  );
}
