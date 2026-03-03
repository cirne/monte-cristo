"use client";

import React from "react";
import type { Segment } from "@/lib/linkify";

interface EntityLinkProps {
  segment: Extract<Segment, { type: "link" }>;
  onOpenEntity: (entityId: string) => void;
}

export function EntityLink({ segment, onOpenEntity }: EntityLinkProps) {
  const linkClassName = [
    "text-stone-800 dark:text-stone-300",
    "underline decoration-solid decoration-stone-300 dark:decoration-stone-600 underline-offset-2",
    "hover:decoration-amber-800 dark:hover:decoration-amber-300",
    "hover:text-amber-800 dark:hover:text-amber-300",
    "cursor-pointer bg-transparent border-none p-0 align-baseline",
  ].join(" ");

  return (
    <a
      href="#"
      role="button"
      data-entity-link="true"
      {...(segment.entityType === "person" ? { "data-person-entity-id": segment.entityId } : {})}
      onClick={(e) => {
        e.preventDefault();
        onOpenEntity(segment.entityId);
      }}
      className={linkClassName}
    >
      {segment.content}
    </a>
  );
}
