"use client";

import React from "react";
import type { EntityType } from "@/lib/chapter-index";
import type { SceneWithDetails } from "@/lib/scenes";
import type { Segment } from "@/lib/linkify";

export interface XRayEntityData {
  name: string;
  aliases: string[];
  spoilerFreeIntro?: string;
  firstSeenInChapter: number;
  excerpt?: string;
  type: EntityType;
}
/** Segment of the intro paragraph: plain text or a link to another entity */
type IntroSegment =
  | { type: "text"; content: string }
  | { type: "entity"; content: string; entityId: string };

/** Split intro text into segments, with entity names/aliases as linkable segments */
function parseIntroForEntityLinks(
  intro: string,
  entityData: Record<string, XRayEntityData>,
  currentEntityId: string
): IntroSegment[] {
  const segments: IntroSegment[] = [];
  const patterns: { pattern: string; entityId: string }[] = [];
  for (const [id, data] of Object.entries(entityData)) {
    if (id === currentEntityId) continue;
    if (data.name) patterns.push({ pattern: data.name, entityId: id });
    for (const alias of data.aliases) {
      if (alias) patterns.push({ pattern: alias, entityId: id });
    }
  }
  patterns.sort((a, b) => b.pattern.length - a.pattern.length);

  let i = 0;
  while (i < intro.length) {
    let matched: { pattern: string; entityId: string } | null = null;
    for (const { pattern, entityId } of patterns) {
      if (
        intro.slice(i, i + pattern.length) === pattern &&
        (matched === null || pattern.length > matched.pattern.length)
      ) {
        matched = { pattern, entityId };
      }
    }
    if (matched) {
      segments.push({
        type: "entity",
        content: matched.pattern,
        entityId: matched.entityId,
      });
      i += matched.pattern.length;
    } else {
      segments.push({ type: "text", content: intro[i] });
      i += 1;
    }
  }

  const merged: IntroSegment[] = [];
  for (const seg of segments) {
    if (seg.type === "text") {
      if (merged.length > 0 && merged[merged.length - 1].type === "text") {
        (merged[merged.length - 1] as { content: string }).content += seg.content;
      } else {
        merged.push(seg);
      }
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

interface XRayPanelProps {
  entityId: string | null;
  entityData: Record<string, XRayEntityData>;
  chapterNumber: number;
  baselineIntro?: string;
  onClose: () => void;
  onSelectEntity?: (entityId: string) => void;
}

export function XRayPanel({
  entityId,
  entityData,
  chapterNumber,
  baselineIntro,
  onClose,
  onSelectEntity,
}: XRayPanelProps) {
  const [imageError, setImageError] = React.useState(false);
  React.useEffect(() => setImageError(false), [entityId]);

  if (!entityId) return null;

  const data = entityData[entityId];
  if (!data) return null;

  const isFirstChapter = chapterNumber === 1;
  const introText = data.spoilerFreeIntro ?? data.name;
  const introSegments =
    onSelectEntity && Object.keys(entityData).length > 1
      ? parseIntroForEntityLinks(introText, entityData, entityId)
      : ([{ type: "text" as const, content: introText }] as IntroSegment[]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold text-stone-900">{data.name}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 p-1 -m-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Entity portrait when image exists (convention: /images/entities/{id}.webp) */}
          <div className="flex justify-center mb-4">
            {!imageError && (
              <div className="rounded-lg overflow-hidden bg-stone-100 w-52 h-64 flex-shrink-0">
                <img
                  src={`/images/entities/${entityId}.webp`}
                  alt=""
                  className="w-full h-full object-cover object-top"
                  onError={() => setImageError(true)}
                />
              </div>
            )}
          </div>

          {data.aliases.length > 0 && (
            <p className="text-xs text-stone-500 mb-2">
              Also known as: {data.aliases.join(", ")}
            </p>
          )}

          <p className="text-base text-stone-700 leading-relaxed mb-3">
            {introSegments.map((seg, idx) =>
              seg.type === "text" ? (
                <React.Fragment key={idx}>{seg.content}</React.Fragment>
              ) : (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectEntity?.(seg.entityId)}
                  className="text-amber-700 hover:text-amber-800 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
                >
                  {seg.content}
                </button>
              )
            )}
          </p>

          {isFirstChapter && baselineIntro && (
            <p className="text-sm text-stone-600 mb-3 italic">{baselineIntro}</p>
          )}

          <p className="text-xs text-stone-500 mb-2">
            First appears in Chapter {data.firstSeenInChapter}
          </p>

          {data.excerpt && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">
                In this chapter
              </p>
              <p className="text-sm text-stone-600 italic">&ldquo;{data.excerpt}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChapterContentProps {
  paragraphSegments: Segment[][];
  /** Scenes from chapter index (SceneWithDetails[]): startParagraph determines where each scene image is shown. */
  scenes: SceneWithDetails[];
  chapterNumber: number;
  xrayData: Record<string, XRayEntityData>;
  baselineIntro?: string;
}

/** True if this paragraph is only a placeholder (e.g. stripped PG page marker). */
function isPlaceholderParagraph(segments: Segment[]): boolean {
  const text = segments.map((s) => s.content).join("");
  return segments.length > 0 && /^[\s\u200B]*$/.test(text);
}

interface ReaderFooterProps {
  /** Scene location label (from current scene in view). */
  locationLabel: string | null;
  /** Character entity IDs mentioned in the visible text (order preserved). */
  visibleCharacterIds: string[];
  xrayData: Record<string, XRayEntityData>;
  onOpenEntity: (entityId: string) => void;
}

function ReaderFooter({ locationLabel, visibleCharacterIds, xrayData, onOpenEntity }: ReaderFooterProps) {
  const hasContent = (locationLabel?.trim()?.length ?? 0) > 0 || visibleCharacterIds.length > 0;
  if (!hasContent) return null;

  /** IDs we still render for exit animation (fade out then remove). */
  const [exitingIds, setExitingIds] = React.useState<string[]>([]);
  const timeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevVisibleRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const prev = prevVisibleRef.current;
    const next = visibleCharacterIds;
    prevVisibleRef.current = next;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const nextSet = new Set(next);
    const removed = prev.filter((id) => !nextSet.has(id));

    if (removed.length > 0) {
      setExitingIds((current) => {
        const combined = [...new Set([...removed, ...current])];
        removed.forEach((id) => {
          const t = setTimeout(() => {
            setExitingIds((c) => c.filter((x) => x !== id));
          }, 500);
          timeoutsRef.current.push(t);
        });
        return combined;
      });
    } else {
      setExitingIds((c) => c.filter((id) => nextSet.has(id)));
    }
  }, [visibleCharacterIds]);

  /** Display list: visible first (alphabetical by id), then exiting (alphabetical). */
  const displayedIds = React.useMemo(() => {
    const visibleSet = new Set(visibleCharacterIds);
    const ordered = [...visibleCharacterIds];
    const exiting = exitingIds.filter((id) => !visibleSet.has(id)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...exiting];
  }, [visibleCharacterIds, exitingIds]);

  const isExiting = (id: string) => exitingIds.includes(id) && !visibleCharacterIds.includes(id);

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-stone-50/95 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90"
      role="contentinfo"
      aria-label="Current scene"
    >
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {displayedIds.map((entityId) => {
            const data = xrayData[entityId];
            const name = data?.name ?? entityId;
            const leaving = isExiting(entityId);
            return (
              <FooterAvatar key={entityId} entityId={entityId} name={name} leaving={leaving} onOpenEntity={onOpenEntity} />
            );
          })}
        </div>
        {locationLabel?.trim() && (
          <span className="text-sm text-stone-600 text-right ml-auto" title="Scene location">
            {locationLabel}
          </span>
        )}
      </div>
    </footer>
  );
}

/** Single avatar in footer: fades in on mount, fades out when leaving. */
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

  return (
    <button
      type="button"
      onClick={() => !leaving && onOpenEntity(entityId)}
      disabled={leaving}
      className={`rounded-full overflow-hidden w-8 h-8 flex-shrink-0 border border-stone-200 bg-stone-100 hover:ring-2 hover:ring-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-opacity duration-500 ${mounted && !leaving ? "opacity-100" : "opacity-0 pointer-events-none"}`}
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

export function ChapterContent({
  paragraphSegments,
  scenes,
  chapterNumber,
  xrayData,
  baselineIntro,
}: ChapterContentProps) {
  const [openEntityId, setOpenEntityId] = React.useState<string | null>(null);
  const articleRef = React.useRef<HTMLDivElement>(null);
  const [visibleParagraphIndices, setVisibleParagraphIndices] = React.useState<Set<number>>(() => new Set());

  /** Track which paragraphs intersect the viewport; current scene = earliest scene that overlaps any visible paragraph. */
  React.useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const paragraphs = el.querySelectorAll<HTMLElement>("[data-paragraph-index]");
    if (paragraphs.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleParagraphIndices((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const idx = entry.target.getAttribute("data-paragraph-index");
            if (idx === null) continue;
            const n = parseInt(idx, 10);
            if (isNaN(n)) continue;
            if (entry.isIntersecting) next.add(n);
            else next.delete(n);
          }
          return next;
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.1 }
    );
    paragraphs.forEach((p) => observer.observe(p));
    return () => paragraphs.forEach((p) => observer.unobserve(p));
  }, [paragraphSegments.length]);

  /** Earliest scene (by startParagraph) that contains at least one visible paragraph. */
  const currentScene = React.useMemo(() => {
    if (visibleParagraphIndices.size === 0 || !scenes?.length) return null;
    const visible = Array.from(visibleParagraphIndices);
    const overlapping = scenes
      .filter((s) => visible.some((i) => i >= s.startParagraph && i <= s.endParagraph))
      .sort((a, b) => a.startParagraph - b.startParagraph);
    return overlapping[0] ?? null;
  }, [scenes, visibleParagraphIndices]);

  /** Character entity IDs linked in the visible paragraphs (order: alphabetical by id). */
  const visibleCharacterIds = React.useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    const sortedIndices = Array.from(visibleParagraphIndices).sort((a, b) => a - b);
    for (const i of sortedIndices) {
      const segments = paragraphSegments[i];
      if (!segments) continue;
      for (const seg of segments) {
        if (seg.type === "link" && seg.entityType === "person" && !seen.has(seg.entityId)) {
          seen.add(seg.entityId);
          ids.push(seg.entityId);
        }
      }
    }
    return ids.sort((a, b) => a.localeCompare(b));
  }, [paragraphSegments, visibleParagraphIndices]);

  /** Map: paragraph index -> scene image key (e.g. ch1-scene0). Matches index format: scenes[i].startParagraph -> ch{N}-scene{i}. */
  const sceneKeyByParagraphStart = React.useMemo(() => {
    const map: Record<number, string> = {};
    if (!Array.isArray(scenes)) return map;
    scenes.forEach((scene, sceneIndex) => {
      const start = scene?.startParagraph;
      if (typeof start === "number" && start >= 0) {
        map[start] = `ch${chapterNumber}-scene${sceneIndex}`;
      }
    });
    return map;
  }, [scenes, chapterNumber]);

  return (
    <>
      <div ref={articleRef} className="prose prose-stone prose-xl max-w-none pb-20">
        {paragraphSegments.map((segments, i) => (
          <React.Fragment key={i}>
            {sceneKeyByParagraphStart[i] != null && (
              <figure className="my-6 -mx-2 rounded-lg overflow-hidden">
                <img
                  src={`/images/scenes/${sceneKeyByParagraphStart[i]}.webp`}
                  alt=""
                  className="w-full h-auto max-w-full"
                  onError={(e) => {
                    const fig = e.currentTarget.closest("figure");
                    if (fig) (fig as HTMLElement).style.display = "none";
                  }}
                />
              </figure>
            )}
            <p
              data-paragraph-index={i}
              className={
                isPlaceholderParagraph(segments)
                  ? "text-xl leading-relaxed text-stone-800 mb-0 min-h-0 overflow-hidden"
                  : "text-xl mb-4 leading-relaxed text-stone-800"
              }
            >
            {segments.map((seg, j) =>
              seg.type === "text" ? (
                <React.Fragment key={j}>{seg.content}</React.Fragment>
              ) : (
                <button
                  key={j}
                  type="button"
                  onClick={() => setOpenEntityId(seg.entityId)}
                  className="text-amber-700 hover:text-amber-800 hover:underline font-medium cursor-pointer bg-transparent border-none p-0 align-baseline"
                >
                  {seg.content}
                </button>
              )
            )}
            </p>
          </React.Fragment>
        ))}
      </div>

      <XRayPanel
        entityId={openEntityId}
        entityData={xrayData}
        chapterNumber={chapterNumber}
        baselineIntro={baselineIntro}
        onClose={() => setOpenEntityId(null)}
        onSelectEntity={setOpenEntityId}
      />
      <ReaderFooter
        locationLabel={currentScene?.locationDescription ?? null}
        visibleCharacterIds={visibleCharacterIds}
        xrayData={xrayData}
        onOpenEntity={setOpenEntityId}
      />
    </>
  );
}
