"use client";

import React from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";
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
}

export function ReaderFooter({
  locationLabel,
  visibleCharacterIds,
  xrayData,
  onOpenEntity,
}: ReaderFooterProps) {
  const { uniqueDisplayedIds, isExiting } = useFooterAvatarList(visibleCharacterIds);
  const { isLargeScreen, isSmallScreen, showLocationExpanded, setShowLocationExpanded } =
    useFooterViewport();

  const hasLocation = Boolean(locationLabel?.trim());
  const hasContent = hasLocation || uniqueDisplayedIds.length > 0;
  if (!hasContent) return null;

  // Small: View A = avatars expanded + map button on right (no location). View B = location right + avatars collapsed.
  const showLocationTextRight =
    hasLocation && (isLargeScreen || showLocationExpanded);
  const showMapButtonRight =
    isSmallScreen && hasLocation && !showLocationExpanded;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90"
      role="contentinfo"
      aria-label="Current scene"
    >
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4 flex-wrap min-h-10">
        <FooterAvatarSection
          isLargeScreen={isLargeScreen}
          isSmallScreen={isSmallScreen}
          uniqueDisplayedIds={uniqueDisplayedIds}
          xrayData={xrayData}
          isExiting={isExiting}
          onOpenEntity={onOpenEntity}
          showLocationExpanded={showLocationExpanded}
          onCollapseLocation={() => setShowLocationExpanded(false)}
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

const FOOTER_EXIT_DELAY_MS = 500;
const LARGE_SCREEN_MQ = "(min-width: 768px)";

function useFooterAvatarList(visibleCharacterIds: string[]) {
  const [exitingIds, setExitingIds] = React.useState<string[]>([]);
  const [displayedIds, setDisplayedIds] = React.useState<string[]>([]);
  const timeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevVisibleRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const prev = prevVisibleRef.current;
    const next = dedupeIds(visibleCharacterIds);
    const nextSet = new Set(next);
    prevVisibleRef.current = next;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const removed = prev.filter((id) => !nextSet.has(id));
    if (removed.length > 0) {
      setExitingIds((c) => dedupeIds([...removed, ...c]));
      removed.forEach((id) => {
        const t = setTimeout(() => {
          setExitingIds((e) => e.filter((x) => x !== id));
          setDisplayedIds((d) => d.filter((x) => x !== id));
        }, FOOTER_EXIT_DELAY_MS);
        timeoutsRef.current.push(t);
      });
    } else {
      setExitingIds((c) => c.filter((id) => nextSet.has(id)));
    }

    const added = next.filter((id) => !prev.includes(id));
    if (added.length > 0) {
      setDisplayedIds((current) => mergeIdsFollowingOrder(current, added, next));
    } else if (prev.length === 0 && next.length > 0) {
      setDisplayedIds(sortIdsAlphabetically(next));
    }

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [visibleCharacterIds]);

  const isExiting = (id: string) =>
    exitingIds.includes(id) && !visibleCharacterIds.includes(id);
  const uniqueDisplayedIds = dedupeIds(displayedIds);

  return { uniqueDisplayedIds, isExiting };
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
// Id / array helpers (pure)
// -----------------------------------------------------------------------------

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function sortIdsAlphabetically(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function mergeIdsFollowingOrder(
  current: string[],
  toAdd: string[],
  order: string[]
): string[] {
  const result = [...current];
  const toInsert = order.filter((id) => toAdd.includes(id));
  for (const newId of toInsert) {
    if (result.includes(newId)) continue;
    const insertAfter = order[order.indexOf(newId) - 1];
    const at = insertAfter == null ? 0 : result.indexOf(insertAfter) + 1;
    result.splice(at, 0, newId);
  }
  return result;
}

// -----------------------------------------------------------------------------
// Footer sections & UI blocks
// -----------------------------------------------------------------------------

const MAX_STACKED_AVATARS = 3;
const STACK_OVERLAP_PX = 32;

interface FooterAvatarSectionProps {
  isLargeScreen: boolean;
  isSmallScreen: boolean;
  uniqueDisplayedIds: string[];
  xrayData: Record<string, XRayEntityData>;
  isExiting: (id: string) => boolean;
  onOpenEntity: (entityId: string) => void;
  showLocationExpanded: boolean;
  onCollapseLocation: () => void;
}

function FooterAvatarSection({
  isLargeScreen,
  isSmallScreen,
  uniqueDisplayedIds,
  xrayData,
  isExiting,
  onOpenEntity,
  showLocationExpanded,
  onCollapseLocation,
}: FooterAvatarSectionProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap overflow-hidden min-w-0 flex-1 min-w-0 justify-start">
      {isLargeScreen &&
        uniqueDisplayedIds.map((entityId) => (
          <AnimatedAvatar
            key={entityId}
            entityId={entityId}
            name={xrayData[entityId]?.name ?? entityId}
            leaving={isExiting(entityId)}
            onOpenEntity={onOpenEntity}
          />
        ))}
      {isSmallScreen && uniqueDisplayedIds.length > 0 && (
        <SmallScreenAvatarBlock
          uniqueDisplayedIds={uniqueDisplayedIds}
          xrayData={xrayData}
          isStacked={showLocationExpanded}
          maxStacked={MAX_STACKED_AVATARS}
          overlapPx={STACK_OVERLAP_PX}
          isExiting={isExiting}
          onStackClick={onCollapseLocation}
          onAvatarClick={onOpenEntity}
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
      ? "text-sm text-stone-600 truncate min-w-0 h-10 flex items-center justify-center leading-10 shrink"
      : "text-sm text-stone-600 text-right flex-1 min-w-0 truncate";
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
      className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
      title="Show scene location"
      aria-label="Show scene location"
    >
      <MapPin className="w-5 h-5 text-stone-600" aria-hidden />
    </button>
  );
}

// -----------------------------------------------------------------------------
// Avatar components
// -----------------------------------------------------------------------------

function SmallScreenAvatarBlock({
  uniqueDisplayedIds,
  xrayData,
  isStacked,
  maxStacked,
  overlapPx,
  isExiting,
  onStackClick,
  onAvatarClick,
}: {
  uniqueDisplayedIds: string[];
  xrayData: Record<string, XRayEntityData>;
  isStacked: boolean;
  maxStacked: number;
  overlapPx: number;
  isExiting: (id: string) => boolean;
  onStackClick: () => void;
  onAvatarClick: (entityId: string) => void;
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
    ? uniqueDisplayedIds.slice(-maxStacked)
    : uniqueDisplayedIds;

  return (
    <div
      role={isStacked ? "button" : undefined}
      tabIndex={isStacked ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={isStacked ? (e) => e.key === "Enter" && onStackClick() : undefined}
      className={`flex items-center shrink-0 ${isStacked ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded-full" : ""}`}
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
            <AnimatedAvatar
              entityId={entityId}
              name={name}
              leaving={isExiting(entityId)}
              onOpenEntity={isStacked ? undefined : onAvatarClick}
            />
          </div>
        );
      })}
    </div>
  );
}

function AnimatedAvatar({
  entityId,
  name,
  leaving,
  onOpenEntity,
}: {
  entityId: string;
  name: string;
  leaving: boolean;
  onOpenEntity?: (entityId: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (mounted) return;
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [mounted]);

  const visible = mounted && !leaving;
  const baseClass =
    "h-10 min-w-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 transition-[opacity,width] duration-500 " +
    (visible ? "w-10 opacity-100" : "w-0 opacity-0 pointer-events-none border-0");
  const interactiveClass =
    "hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500";
  const content = <CharacterAvatar entityId={entityId} name={name} />;

  if (onOpenEntity != null) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!leaving) onOpenEntity(entityId);
        }}
        disabled={leaving}
        className={`${baseClass} ${interactiveClass}`}
        title={name}
        aria-label={`View ${name}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={baseClass} aria-hidden>
      {content}
    </div>
  );
}

function CharacterAvatar({ entityId, name }: { entityId: string; name: string }) {
  const [imgError, setImgError] = React.useState(false);
  if (imgError) {
    return (
      <span className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={`/images/entities/${entityId}.webp`}
      alt=""
      width={40}
      height={40}
      className="w-full h-full object-cover object-top"
      onError={() => setImgError(true)}
    />
  );
}
