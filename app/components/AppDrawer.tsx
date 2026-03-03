"use client";

import React from "react";
import { Drawer } from "vaul";

export interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible label for the drawer */
  ariaLabel: string;
  /** Optional title (e.g. for Drawer.Title). If not set, ariaLabel is used for title. */
  title?: string;
  children: React.ReactNode;
  /** Optional class for the drawer panel content container. */
  contentClassName?: string;
}

/**
 * Shared Vaul drawer wrapper used for overlays across the app.
 */
export function AppDrawer({
  open,
  onOpenChange,
  ariaLabel,
  title,
  children,
  contentClassName,
}: AppDrawerProps) {
  const handleOpenChange = React.useCallback(
    (next: boolean) => onOpenChange(next),
    [onOpenChange]
  );

  const drawerPanelClass =
    contentClassName ??
    "w-full max-h-[90vh] flex flex-col outline-none bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl";

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex w-full justify-center outline-none"
          aria-label={ariaLabel}
          aria-describedby={undefined}
        >
          <div className={`${drawerPanelClass} max-w-[min(80vw,36rem)] rounded-t-xl rounded-b-none`}>
            <div className="mx-auto mt-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-stone-300 dark:bg-stone-600" />
            <Drawer.Title className="sr-only">{title ?? ariaLabel}</Drawer.Title>
            <div className="overflow-y-auto max-h-[calc(90vh-3rem)] shrink-0 px-4 pt-0 pb-4">
              {children}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
