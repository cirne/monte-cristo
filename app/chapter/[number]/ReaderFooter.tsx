"use client";

import React from "react";
import { MapPin } from "lucide-react";
import type { XRayEntityData } from "./XRayPanel";

export interface ReaderFooterProps {
  /** Scene location label (from current scene in view). */
  locationLabel: string | null;
  /** Character entity IDs mentioned in the visible text (order preserved). */
  visibleCharacterIds: string[];
  xrayData: Record<string, XRayEntityData>;
  onOpenEntity: (entityId: string) => void;
}

const FOOTER_EXIT_DELAY_MS = 500;
/** Breakpoint for "large enough for both": same as Tailwind md (768px). */
const LARGE_SCREEN_MQ = "(min-width: 768px)";
/** Max avatars to show in the stacked (location-expanded) view on small screens. */
const MAX_STACKED_AVATARS = 3;

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function sortIdsAlphabetically(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/** Merge `toAdd` into `current` following the order of `order`. Skips ids already in current. */
function mergeIdsFollowingOrder(current: string[], toAdd: string[], order: string[]): string[] {
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

function clearAllTimeouts(timeoutsRef: React.MutableRefObject<ReturnType<typeof setTimeout>[]>) {
  timeoutsRef.current.forEach(clearTimeout);
  timeoutsRef.current = [];
}

export function ReaderFooter({ locationLabel, visibleCharacterIds, xrayData, onOpenEntity }: ReaderFooterProps) {
  /** IDs we still render for exit animation (fade/shrink out then remove). */
  const [exitingIds, setExitingIds] = React.useState<string[]>([]);
  /** Display order: keeps exiting items in place so they shrink and others slide. */
  const [displayedIds, setDisplayedIds] = React.useState<string[]>([]);
  /** On small screens: true = show location text (replacing avatars); false = show avatars + location icon. Reverts on scroll. */
  const [showLocationExpanded, setShowLocationExpanded] = React.useState(false);
  /** Large viewport: show both avatars and location; small: use icon + expand. */
  const [isLargeScreen, setIsLargeScreen] = React.useState(true);
  const timeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevVisibleRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const mql = window.matchMedia(LARGE_SCREEN_MQ);
    const handle = () => setIsLargeScreen(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  /** Revert to avatar mode when user scrolls (small screens only). */
  React.useEffect(() => {
    const handleScroll = () => setShowLocationExpanded((prev) => (prev ? false : prev));
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** Sync displayed/exiting avatars with visible characters; cleanup cancels pending exit timeouts to avoid leaks and setState-after-unmount. */
  React.useEffect(() => {
    const prev = prevVisibleRef.current;
    const next = dedupeIds(visibleCharacterIds);
    const nextSet = new Set(next);
    prevVisibleRef.current = next;

    clearAllTimeouts(timeoutsRef);

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

    return () => clearAllTimeouts(timeoutsRef);
  }, [visibleCharacterIds]);

  const isExiting = (id: string) => exitingIds.includes(id) && !visibleCharacterIds.includes(id);

  const hasContent = (locationLabel?.trim()?.length ?? 0) > 0 || displayedIds.length > 0;
  if (!hasContent) return null;

  const uniqueDisplayedIds = dedupeIds(displayedIds);
  const hasLocation = Boolean(locationLabel?.trim());

  /** Small screen: show either avatars+icon or stacked avatars + location. Large: always avatars + location. */
  const showLocationTextLarge = isLargeScreen && hasLocation;
  const showLocationTextSmall = !isLargeScreen && showLocationExpanded && hasLocation;
  const showLocationIcon = !isLargeScreen && hasLocation && !showLocationExpanded;

  /** On small screens we use a single avatar list that animates between row and stacked so expand and collapse both animate. */
  const isSmallScreen = !isLargeScreen;
  const overlapPx = 32; // each avatar shows 8px when stacked (40 - 32)

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90"
      role="contentinfo"
      aria-label="Current scene"
    >
      <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4 flex-wrap min-h-10">
        <div className="flex items-center gap-2 flex-wrap overflow-hidden min-w-0 flex-1 min-w-0 justify-center md:justify-start">
          {isLargeScreen &&
            uniqueDisplayedIds.map((entityId) => {
              const data = xrayData[entityId];
              const name = data?.name ?? entityId;
              const leaving = isExiting(entityId);
              return (
                <FooterAvatar key={entityId} entityId={entityId} name={name} leaving={leaving} onOpenEntity={onOpenEntity} />
              );
            })}
          {isSmallScreen && uniqueDisplayedIds.length > 0 && (
            <>
              <SmallScreenAvatarBlock
                uniqueDisplayedIds={uniqueDisplayedIds}
                xrayData={xrayData}
                isStacked={showLocationExpanded}
                maxStacked={MAX_STACKED_AVATARS}
                onStackClick={() => setShowLocationExpanded(false)}
                onAvatarClick={onOpenEntity}
                overlapPx={overlapPx}
                isExiting={isExiting}
              />
              {showLocationTextSmall && (
                <span className="text-sm text-stone-600 truncate min-w-0 h-10 flex items-center justify-center leading-10 shrink" title="Scene location">
                  {locationLabel}
                </span>
              )}
              {showLocationIcon && (
                <button
                  type="button"
                  onClick={() => setShowLocationExpanded(true)}
                  className="shrink-0 h-10 w-10 flex items-center justify-center rounded-full border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  title="Show scene location"
                  aria-label="Show scene location"
                >
                  <MapPin className="w-5 h-5 text-stone-600" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
        {showLocationTextLarge && (
          <span className="text-sm text-stone-600 text-right shrink-0" title="Scene location">
            {locationLabel}
          </span>
        )}
      </div>
    </footer>
  );
}

/** Small-screen only: one avatar list that animates between row and stacked so expand/collapse both animate. */
function SmallScreenAvatarBlock({
  uniqueDisplayedIds,
  xrayData,
  isStacked,
  maxStacked,
  onStackClick,
  onAvatarClick,
  overlapPx,
  isExiting,
}: {
  uniqueDisplayedIds: string[];
  xrayData: Record<string, XRayEntityData>;
  isStacked: boolean;
  maxStacked: number;
  onStackClick: () => void;
  onAvatarClick: (entityId: string) => void;
  overlapPx: number;
  isExiting: (id: string) => boolean;
}) {
  const handleContainerClick = (e: React.MouseEvent) => {
    if (isStacked) {
      onStackClick();
      return;
    }
    const target = e.target as HTMLElement;
    const cell = target.closest("[data-entity-id]");
    if (cell) {
      const id = (cell as HTMLElement).getAttribute("data-entity-id");
      if (id && !isExiting(id)) onAvatarClick(id);
    }
  };

  const idsToShow = isStacked ? uniqueDisplayedIds.slice(-maxStacked) : uniqueDisplayedIds;

  return (
    <div
      role={isStacked ? "button" : undefined}
      tabIndex={isStacked ? 0 : undefined}
      onClick={handleContainerClick}
      onKeyDown={isStacked ? (e) => e.key === "Enter" && onStackClick() : undefined}
      className={`flex items-center shrink-0 ${isStacked ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded-full" : ""}`}
      aria-label={isStacked ? "Show characters" : undefined}
      title={isStacked ? "Show characters" : undefined}
    >
      {idsToShow.map((entityId, i) => {
        const data = xrayData[entityId];
        const name = data?.name ?? entityId;
        const stackedOffset = isStacked ? -i * overlapPx : 0;
        return (
          <div
            key={entityId}
            data-entity-id={entityId}
            className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-stone-50 overflow-hidden bg-stone-100 ring-1 ring-stone-200/80 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${stackedOffset}px)` }}
            title={!isStacked ? name : undefined}
            role={!isStacked ? "button" : undefined}
            tabIndex={!isStacked ? 0 : undefined}
            aria-label={!isStacked ? `View ${name}` : undefined}
          >
            <CharacterAvatar entityId={entityId} name={name} />
          </div>
        );
      })}
    </div>
  );
}

/** Single avatar in footer: fades/slides in on mount, fades/slides out when leaving. */
function FooterAvatar({
  entityId,
  name,
  leaving,
  onOpenEntity,
}: {
  entityId: string;
  name: string;
  leaving: boolean;
  onOpenEntity: (entityId: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (mounted) return;
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [mounted]);

  const visible = mounted && !leaving;
  return (
    <button
      type="button"
      onClick={() => !leaving && onOpenEntity(entityId)}
      disabled={leaving}
      className={`h-10 min-w-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-[opacity,width] duration-500 ${visible ? "w-10 opacity-100" : "w-0 opacity-0 pointer-events-none border-0"}`}
      title={name}
      aria-label={`View ${name}`}
    >
      <CharacterAvatar entityId={entityId} name={name} />
    </button>
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
    <img
      src={`/images/entities/${entityId}.webp`}
      alt=""
      className="w-full h-full object-cover object-top"
      onError={() => setImgError(true)}
    />
  );
}
