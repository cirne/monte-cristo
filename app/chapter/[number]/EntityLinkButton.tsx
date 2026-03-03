"use client";

import React from "react";

interface EntityLinkButtonProps {
  entityId: string;
  content: string;
  onOpenEntity: () => void;
}

export function EntityLinkButton({ entityId, content, onOpenEntity }: EntityLinkButtonProps) {
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenEntity();
      }}
      className={linkClassName}
    >
      {content}
    </a>
  );
}
