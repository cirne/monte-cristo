/**
 * Scene delineation for chapter text.
 * Scenes are identified by paragraph index ranges and come from the chapter index
 * (LLM-derived at index time). Use index entry's scenes when rendering; use
 * getParagraphs / getSingleScene only for indexing and fallback.
 */

import { isCanonicalHtml, htmlToParagraphs } from "./canonical-html";

export interface Scene {
  /** 0-based paragraph index where this scene starts (inclusive) */
  startParagraph: number;
  /** 0-based paragraph index where this scene ends (inclusive) */
  endParagraph: number;
}

/** Rich scene data from LLM analysis; extends Scene with metadata for display and image generation. */
export interface SceneWithDetails extends Scene {
  /** Short location/setting label, e.g. "In the Captain's chamber" */
  locationDescription?: string;
  /** Description suitable for DALL·E / image generation for this scene */
  imageDescription?: string;
  /** Brief caption to display under the scene image (spoiler-free, can use character names) */
  imageSubtitle?: string;
  /** Short spoiler-safe summary of what happens in this scene */
  summary?: string;
  /** Entity IDs (from entity store) of characters present in this scene */
  characterIds?: string[];
}

/** Entity reference passed to the LLM so it can return characterIds from our canonical list. */
export interface EntityRefForScenes {
  id: string;
  name: string;
  type: string;
}

/**
 * Split chapter content into paragraphs.
 * Supports canonical HTML (content with <p>...</p>) or legacy plain text (double newline).
 * Single newlines within a paragraph are preserved in plain text; normalized to space in HTML.
 */
export function getParagraphs(content: string): string[] {
  if (isCanonicalHtml(content)) {
    const fromHtml = htmlToParagraphs(content);
    if (fromHtml.length > 0) return fromHtml;
  }
  return content
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

/** Single scene covering the whole chapter. Used as fallback when LLM scene detection fails. */
export function getSingleScene(content: string): Scene[] {
  const paragraphs = getParagraphs(content);
  if (paragraphs.length === 0) return [];
  return [{ startParagraph: 0, endParagraph: paragraphs.length - 1 }];
}

function clampToParagraphRange(value: number, paragraphCount: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.floor(value);
  if (rounded < 0) return 0;
  if (rounded > paragraphCount - 1) return paragraphCount - 1;
  return rounded;
}

function mergeSceneMetadata(base: SceneWithDetails, incoming: SceneWithDetails): SceneWithDetails {
  return {
    ...base,
    locationDescription: base.locationDescription?.trim()
      ? base.locationDescription
      : incoming.locationDescription,
    imageDescription: base.imageDescription?.trim() ? base.imageDescription : incoming.imageDescription,
    imageSubtitle: base.imageSubtitle?.trim() ? base.imageSubtitle : incoming.imageSubtitle,
    summary: base.summary?.trim() ? base.summary : incoming.summary,
    characterIds: base.characterIds?.length
      ? [...new Set(base.characterIds)]
      : (incoming.characterIds?.length ? [...new Set(incoming.characterIds)] : undefined),
  };
}

/**
 * Normalize scene boundaries so they are:
 * - sorted by startParagraph
 * - non-overlapping
 * - contiguous from paragraph 0 through paragraphCount - 1
 *
 * Metadata is preserved per unique startParagraph and merged non-destructively.
 */
export function normalizeScenes(
  scenes: SceneWithDetails[] | undefined,
  paragraphCount: number
): SceneWithDetails[] {
  if (paragraphCount <= 0) return [];
  if (!scenes?.length) {
    return [{ startParagraph: 0, endParagraph: paragraphCount - 1 }];
  }

  const byStart = new Map<number, SceneWithDetails>();
  for (const scene of scenes) {
    const start = clampToParagraphRange(scene.startParagraph, paragraphCount);
    const normalized = { ...scene, startParagraph: start };
    const existing = byStart.get(start);
    byStart.set(start, existing ? mergeSceneMetadata(existing, normalized) : normalized);
  }

  const starts = [...byStart.keys()].sort((a, b) => a - b);
  if (starts.length === 0 || starts[0] !== 0) {
    starts.unshift(0);
  }

  const normalizedScenes: SceneWithDetails[] = [];
  for (let i = 0; i < starts.length; i++) {
    const startParagraph = starts[i];
    if (startParagraph > paragraphCount - 1) continue;
    const nextStart = i + 1 < starts.length ? starts[i + 1] : paragraphCount;
    const endParagraph = Math.max(startParagraph, Math.min(paragraphCount - 1, nextStart - 1));
    const source = byStart.get(startParagraph);
    normalizedScenes.push({
      ...(source ?? {}),
      startParagraph,
      endParagraph,
    });
  }

  if (normalizedScenes.length === 0) {
    return [{ startParagraph: 0, endParagraph: paragraphCount - 1 }];
  }
  return normalizedScenes;
}
