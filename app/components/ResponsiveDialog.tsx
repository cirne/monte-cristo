"use client";

import React from "react";
import { Drawer } from "vaul";

export const MOBILE_BREAKPOINT = 768;

/** True when viewport is below the mobile breakpoint (< 768px). Use to adapt UI for drawer vs dialog. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible label for the dialog/drawer */
  ariaLabel: string;
  /** Optional title (e.g. for Drawer.Title). If not set, ariaLabel is used for title. */
  title?: string;
  children: React.ReactNode;
  /** Optional class for the content container (dialog box / drawer content). */
  contentClassName?: string;
}

/**
 * Renders a dialog on desktop (>= md) and a Vaul drawer on mobile (< md).
 * Use for overlays that should feel native on mobile (slide-up drawer) and stay as centered modal on larger screens.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  ariaLabel,
  title,
  children,
  contentClassName,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    if (!open || isMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isMobile, handleOpenChange]);

  const sharedContentClass =
    contentClassName ??
    "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl max-w-2xl min-h-[200px]";

  if (isMobile) {
    const drawerPanelClass =
      "w-full max-w-[80vw] max-h-[90vh] flex flex-col rounded-t-xl outline-none bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xl";
    return (
      <Drawer.Root open={open} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex w-full justify-center outline-none"
            aria-label={ariaLabel}
            aria-describedby={undefined}
          >
            <div className={drawerPanelClass}>
              <div className="mx-auto mt-2 h-1.5 w-12 flex-shrink-0 rounded-full bg-stone-300 dark:bg-stone-600" />
              <Drawer.Title className="sr-only">{title ?? ariaLabel}</Drawer.Title>
              <div className="overflow-y-auto max-h-[calc(90vh-3rem)] shrink-0 px-4 pt-2 pb-4">
                {children}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => handleOpenChange(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ariaLabel}
            aria-describedby={undefined}
            className={`${sharedContentClass} w-full max-h-[90vh] overflow-y-auto rounded-xl p-4 sm:p-6`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}
