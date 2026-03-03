"use client";

import React from "react";
import type { EntityTextSegment } from "./entityTextSegments";
import { EntityLinkButton } from "./EntityLinkButton";

interface LinkifiedTextProps {
  segments: EntityTextSegment[];
  onEntityClick?: (entityId: string) => void;
  className?: string;
}

export function LinkifiedText({ segments, onEntityClick, className }: LinkifiedTextProps) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <React.Fragment key={index}>{segment.content}</React.Fragment>
        ) : (
          <EntityLinkButton
            key={index}
            entityId={segment.entityId}
            content={segment.content}
            onOpenEntity={() => onEntityClick?.(segment.entityId)}
          />
        )
      )}
    </>
  );
}
