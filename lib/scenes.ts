/**
 * Scene delineation for chapter text.
 * Scenes are identified by paragraph index ranges and come from the chapter index
 * (LLM-derived at index time). Use index entry's scenes when rendering; use
 * getParagraphs / getSingleScene only for indexing and fallback.
 */

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
 * Split chapter content into paragraphs (double newline).
 * Single newlines within a paragraph are preserved.
 */
export function getParagraphs(content: string): string[] {
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
