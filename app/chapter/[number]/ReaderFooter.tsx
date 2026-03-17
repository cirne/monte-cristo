"use client";

import React from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { DEFAULT_BOOK_SLUG } from "@/lib/books";
import { getImageBase } from "@/lib/env";
import type { XRayEntityData } from "./XRayPanel";

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface ReaderFooterProps {
  /** Scene location label (from current scene in view). */
  locationLabel: string | null;
  /** Character entity IDs mentioned in the visible text (order preserved). */
  visibleCharacterIds: string[];
  xrayData: Record<string, XRayEntityData>;
  onOpenEntity: (entityId: string) => void;
  /** Entity avatars: /images/entities/<bookSlug>/ */
  bookSlug?: string;
}

export function ReaderFooter({
  locationLabel,
  visibleCharacterIds,
  xrayData,
  onOpenEntity,
  bookSlug,
}: ReaderFooterProps) {
  const { displayedIds, isExiting, onExitComplete } = useFooterAvatarList(visibleCharacterIds);
  const { isLargeScreen, isSmallScreen, showLocationExpanded, setShowLocationExpanded } =
    useFooterViewport();

  const entitiesBase = `${getImageBase()}/entities/${bookSlug ?? DEFAULT_BOOK_SLUG}`;

  const hasLocation = Boolean(locationLabel?.trim());
  const hasContent = hasLocation || displayedIds.length > 0;
  if (!hasContent) return null;

  // Small: View A = avatars expanded + map button on right (no location). View B = location right + avatars collapsed.
  const showLocationTextRight =
    hasLocation && (isLargeScreen || showLocationExpanded);
  const showMapButtonRight =
    isSmallScreen && hasLocation && !showLocationExpanded;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90 dark:border-stone-800 dark:bg-stone-950/95 dark:supports-[backdrop-filter]:bg-stone-950/90"
      role="contentinfo"
      aria-label="Current scene"
    >
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4 flex-wrap min-h-10">
        <FooterAvatarSection
          isLargeScreen={isLargeScreen}
          isSmallScreen={isSmallScreen}
          displayedIds={displayedIds}
          xrayData={xrayData}
          isExiting={isExiting}
          onExitComplete={onExitComplete}
          onOpenEntity={onOpenEntity}
          showLocationExpanded={showLocationExpanded}
          onCollapseLocation={() => setShowLocationExpanded(false)}
          entitiesBase={entitiesBase}
        />
        {showMapButtonRight && (
          <LocationExpandButton onExpand={() => setShowLocationExpanded(true)} />
        )}
        {showLocationTextRight && (
          <FooterLocationLabel label={locationLabel!} variant="right" />
        )}
      </div>
    </footer>
  );
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

const EXIT_DELAY_MS = 400; // fallback if transitionend doesn't fire
const LARGE_SCREEN_MQ = "(min-width: 768px)";

/** Source of truth is visibleCharacterIds (regen from parent). We only track ids that just left
 * so we can animate them out. Remove from list when slot's transition ends (or EXIT_DELAY_MS fallback).
 * Do NOT cancel exit when id comes back in view — avoids flicker from list fluctuation. */
function useFooterAvatarList(visibleCharacterIds: string[]) {
  const visibleSet = React.useMemo(
    () => new Set(visibleCharacterIds),
    [visibleCharacterIds]
  );
  const visibleSorted = React.useMemo(
    () => [...visibleSet].sort((a, b) => a.localeCompare(b)),
    [visibleSet]
  );

  const [exitingIds, setExitingIds] = React.useState<string[]>([]);
  const prevVisibleRef = React.useRef<string[]>([]);
  const timeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeFromExiting = React.useCallback((id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t != null) {
      clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
    setExitingIds((ex) => ex.filter((x) => x !== id));
  }, []);

  React.useEffect(() => {
    const prev = prevVisibleRef.current;
    prevVisibleRef.current = visibleSorted;

    const removed = prev.filter((id) => !visibleSet.has(id));

    // Do NOT cancel timeouts when id is back in view — prevents flicker from debounce/scroll jitter

    if (removed.length > 0) {
      setExitingIds((e) => [...new Set([...e, ...removed])]);
      removed.forEach((id) => {
        if (timeoutsRef.current.has(id)) return;
        const t = setTimeout(() => removeFromExiting(id), EXIT_DELAY_MS);
        timeoutsRef.current.set(id, t);
      });
    }
  }, [visibleCharacterIds, visibleSet, visibleSorted, removeFromExiting]);

  const displayedIds = React.useMemo(
    () => [...new Set([...visibleSorted, ...exitingIds])].sort((a, b) => a.localeCompare(b)),
    [visibleSorted, exitingIds]
  );
  const isExiting = (id: string) => exitingIds.includes(id);

  React.useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  return { displayedIds, isExiting, onExitComplete: removeFromExiting };
}

function useFooterViewport() {
  const [isLargeScreen, setIsLargeScreen] = React.useState(true);
  const [showLocationExpanded, setShowLocationExpanded] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(LARGE_SCREEN_MQ);
    const handle = () => setIsLargeScreen(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  React.useEffect(() => {
    const handleScroll = () =>
      setShowLocationExpanded((prev) => (prev ? false : prev));
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return {
    isLargeScreen,
    isSmallScreen: !isLargeScreen,
    showLocationExpanded,
    setShowLocationExpanded,
  };
}

// -----------------------------------------------------------------------------
// Footer sections & UI blocks
// -----------------------------------------------------------------------------

const MAX_STACKED_AVATARS = 3;
const STACK_OVERLAP_PX = 32;

interface FooterAvatarSectionProps {
  isLargeScreen: boolean;
  isSmallScreen: boolean;
  displayedIds: string[];
  xrayData: Record<string, XRayEntityData>;
  isExiting: (id: string) => boolean;
  onExitComplete: (id: string) => void;
  onOpenEntity: (entityId: string) => void;
  showLocationExpanded: boolean;
  onCollapseLocation: () => void;
  entitiesBase: string;
}

function FooterAvatarSection({
  isLargeScreen,
  isSmallScreen,
  displayedIds,
  xrayData,
  isExiting,
  onExitComplete,
  onOpenEntity,
  showLocationExpanded,
  onCollapseLocation,
  entitiesBase,
}: FooterAvatarSectionProps) {
  return (
    <div className="flex items-center flex-wrap overflow-hidden min-w-0 shrink-0 justify-start">
      {isLargeScreen &&
        displayedIds.map((entityId) => (
          <FooterAvatarSlot
            key={entityId}
            entityId={entityId}
            isExiting={isExiting(entityId)}
            onExitComplete={onExitComplete}
          >
            <FooterAvatar
              entityId={entityId}
              name={xrayData[entityId]?.name ?? entityId}
              leaving={isExiting(entityId)}
              onOpenEntity={onOpenEntity}
              entitiesBase={entitiesBase}
            />
          </FooterAvatarSlot>
        ))}
      {isSmallScreen && displayedIds.length > 0 && (
        <SmallScreenAvatarBlock
          displayedIds={displayedIds}
          xrayData={xrayData}
          isExiting={isExiting}
          onExitComplete={onExitComplete}
          isStacked={showLocationExpanded}
          maxStacked={MAX_STACKED_AVATARS}
          overlapPx={STACK_OVERLAP_PX}
          onStackClick={onCollapseLocation}
          onAvatarClick={onOpenEntity}
          entitiesBase={entitiesBase}
        />
      )}
    </div>
  );
}

function FooterLocationLabel({
  label,
  variant,
}: {
  label: string;
  variant: "inline" | "right";
}) {
  const className =
    variant === "inline"
      ? "text-sm text-stone-600 dark:text-stone-400 truncate min-w-0 h-10 flex items-center justify-center leading-10 shrink"
      : "text-sm text-stone-600 dark:text-stone-400 text-right flex-1 min-w-0 truncate";
  return (
    <span className={className} title="Scene location">
      {label}
    </span>
  );
}

function LocationExpandButton({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-800 dark:hover:ring-amber-300 dark:focus:ring-amber-300 transition-all"
      title="Show scene location"
      aria-label="Show scene location"
    >
      <MapPin className="w-5 h-5 text-stone-600 dark:text-stone-300" aria-hidden />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Avatar components
// -----------------------------------------------------------------------------

function FooterAvatarSlot({
  entityId,
  isExiting,
  onExitComplete,
  children,
}: {
  entityId: string;
  isExiting: boolean;
  onExitComplete: (id: string) => void;
  children: React.ReactNode;
}) {
  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName === "width" && isExiting) onExitComplete(entityId);
  };
  // w-12 = 48px = 40px avatar + 8px gap; no parent gap so unmount doesn't cause layout jump
  return (
    <div
      onTransitionEnd={handleTransitionEnd}
      className={
        "overflow-hidden transition-[width] duration-[280ms] ease-out " +
        (isExiting ? "w-0 min-w-0" : "w-12")
      }
    >
      {children}
    </div>
  );
}

function SmallScreenAvatarBlock({
  displayedIds,
  xrayData,
  isExiting,
  onExitComplete,
  isStacked,
  maxStacked,
  overlapPx,
  onStackClick,
  onAvatarClick,
  entitiesBase,
}: {
  displayedIds: string[];
  xrayData: Record<string, XRayEntityData>;
  isExiting: (id: string) => boolean;
  onExitComplete: (id: string) => void;
  isStacked: boolean;
  maxStacked: number;
  overlapPx: number;
  onStackClick: () => void;
  onAvatarClick: (entityId: string) => void;
  entitiesBase: string;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (isStacked) {
      onStackClick();
      return;
    }
    const cell = (e.target as HTMLElement).closest("[data-entity-id]");
    if (cell) {
      const id = (cell as HTMLElement).getAttribute("data-entity-id");
      if (id && !isExiting(id)) onAvatarClick(id);
    }
  };

  const idsToShow = isStacked
    ? displayedIds.slice(-maxStacked)
    : displayedIds;

  return (
    <div
      role={isStacked ? "button" : undefined}
      tabIndex={isStacked ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={isStacked ? (e) => e.key === "Enter" && onStackClick() : undefined}
      className={`flex items-center shrink-0 ${isStacked ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded-full dark:focus:ring-amber-300 dark:focus:ring-offset-stone-950" : ""}`}
      aria-label={isStacked ? "Show characters" : undefined}
      title={isStacked ? "Show characters" : undefined}
    >
      {idsToShow.map((entityId, i) => {
        const name = xrayData[entityId]?.name ?? entityId;
        const stackedOffset = isStacked ? -i * overlapPx : 0;
        return (
          <div
            key={entityId}
            data-entity-id={entityId}
            className="flex-shrink-0 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${stackedOffset}px)` }}
          >
            <FooterAvatarSlot
              entityId={entityId}
              isExiting={isExiting(entityId)}
              onExitComplete={onExitComplete}
            >
              <FooterAvatar
                entityId={entityId}
                name={name}
                leaving={isExiting(entityId)}
                onOpenEntity={isStacked ? undefined : onAvatarClick}
                entitiesBase={entitiesBase}
              />
            </FooterAvatarSlot>
          </div>
        );
      })}
    </div>
  );
}

function FooterAvatar({
  entityId,
  name,
  leaving,
  onOpenEntity,
  entitiesBase,
}: {
  entityId: string;
  name: string;
  leaving?: boolean;
  onOpenEntity?: (entityId: string) => void;
  entitiesBase: string;
}) {
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const content = <CharacterAvatar entityId={entityId} name={name} entitiesBase={entitiesBase} />;
  const interactiveClass =
    "hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:hover:ring-amber-300 dark:focus:ring-amber-300";
  const baseClass =
    "h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800 transition-[transform,opacity] duration-[280ms] ease-out " +
    (leaving
      ? "opacity-0 -translate-x-10 pointer-events-none"
      : !entered
        ? "opacity-0 translate-x-3"
        : "opacity-100 translate-x-0");

  if (onOpenEntity != null) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!leaving) onOpenEntity(entityId);
        }}
        disabled={!!leaving}
        className={`${baseClass} ${interactiveClass}`}
        title={name}
        aria-label={`View ${name}`}
      >
        {content}
      </button>
    );
  }
  return <div className={baseClass} aria-hidden>{content}</div>;
}

function CharacterAvatar({
  entityId,
  name,
  entitiesBase,
}: {
  entityId: string;
  name: string;
  entitiesBase: string;
}) {
  const [imgError, setImgError] = React.useState(false);
  if (imgError) {
    return (
      <span className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500 dark:text-stone-300">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={`${entitiesBase}/${entityId}.webp`}
      alt=""
      width={40}
      height={40}
      className="w-full h-full object-cover object-top"
      onError={() => setImgError(true)}
    />
  );
}
