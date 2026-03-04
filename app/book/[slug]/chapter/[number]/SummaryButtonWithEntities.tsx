"use client";

import React from "react";
import { SummaryButton } from "@/app/chapter/[number]/SummaryButton";
import { XRayPanel } from "@/app/chapter/[number]/XRayPanel";
import type { XRayEntityData } from "@/app/chapter/[number]/XRayPanel";

interface SummaryButtonWithEntitiesProps {
  label: string;
  dialogLabel: string;
  endpoint: string;
  chapterNumber: number;
  bookSlug: string;
  paragraphIndex: number;
  entityData: Record<string, XRayEntityData>;
}

export function SummaryButtonWithEntities({
  label,
  dialogLabel,
  endpoint,
  chapterNumber,
  bookSlug,
  paragraphIndex,
  entityData,
}: SummaryButtonWithEntitiesProps) {
  const [openEntityId, setOpenEntityId] = React.useState<string | null>(null);

  return (
    <>
      <SummaryButton
        label={label}
        dialogLabel={dialogLabel}
        endpoint={endpoint}
        chapterNumber={chapterNumber}
        bookSlug={bookSlug}
        paragraphIndex={paragraphIndex}
        entityData={entityData}
        onOpenEntity={(entityId) => setOpenEntityId(entityId)}
      />
      <XRayPanel
        entityId={openEntityId}
        entityData={entityData}
        chapterNumber={chapterNumber}
        bookSlug={bookSlug}
        onClose={() => {
          setOpenEntityId(null);
        }}
        onSelectEntity={(entityId) => {
          setOpenEntityId(entityId);
        }}
      />
    </>
  );
}
