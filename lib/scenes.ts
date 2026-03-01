/**
 * Scene delineation for chapter text.
 * Scenes are identified by paragraph index ranges (stable under small text edits).
 * Use when processing a chapter: getScenes(content) then slice paragraphs by
 * scene.startParagraph / scene.endParagraph for per-scene analysis or display.
 */

export interface Scene {
  /** 0-based paragraph index where this scene starts (inclusive) */
  startParagraph: number;
  /** 0-based paragraph index where this scene ends (inclusive) */
  endParagraph: number;
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

/**
 * Regex patterns that suggest a new scene when they start a paragraph.
 * Order matters: more specific first. Case-insensitive match on paragraph start.
 */
const SCENE_STARTER_PATTERNS = [
  // Time transitions
  /^(The\s+)?(next|following)\s+(day|morning|evening|night|week|month|year)s?\b/i,
  /^(Some\s+)?(time|days?|weeks?|months?|years?)\s+later\b/i,
  /^(That\s+)(same\s+)?(night|evening|morning|afternoon|day)\b/i,
  /^(A\s+few\s+)(days?|hours?|weeks?|months?)\s+(later|after|before)\b/i,
  /^(Early|Late)\s+(in\s+the\s+)?(morning|evening|afternoon|night)\b/i,
  /^(At\s+)(midnight|noon|dusk|dawn)\b/i,
  /^(On\s+the\s+)(morrow|following\s+day)\b/i,
  // Location / setting shifts
  /^(In|At)\s+(the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,/i, // "In Paris, ..." or "At the château, ..."
  /^(Meanwhile|Meantime)\s*,/i,
  /^(During\s+this\s+time)\s*,/i,
  // Chapter-like breaks (number or roman numeral)
  /^\s*(Chapter\s+\d+|[IVXLCDM]+\.)\s+/i,
];

/**
 * Returns paragraph indices (0-based) where a new scene is considered to start.
 * First paragraph is always 0; then any paragraph whose trimmed start matches
 * a scene-starter pattern starts a new scene.
 */
export function getSceneBreakParagraphIndices(content: string): number[] {
  const paragraphs = getParagraphs(content);
  const indices: number[] = [0];

  for (let i = 1; i < paragraphs.length; i++) {
    const start = paragraphs[i].slice(0, 120);
    const startsNewScene = SCENE_STARTER_PATTERNS.some((re) => re.test(start));
    if (startsNewScene) indices.push(i);
  }

  return indices;
}

/**
 * Delineate scenes using regex-based scene starters.
 * Returns one scene per contiguous range of paragraphs between breaks.
 * Most reliable: paragraph-index based (immune to small text changes).
 */
export function getScenesFromRegex(content: string): Scene[] {
  const paragraphs = getParagraphs(content);
  const breakIndices = getSceneBreakParagraphIndices(content);

  const scenes: Scene[] = [];
  for (let i = 0; i < breakIndices.length; i++) {
    const startParagraph = breakIndices[i];
    const endParagraph =
      i + 1 < breakIndices.length ? breakIndices[i + 1] - 1 : paragraphs.length - 1;
    if (endParagraph >= startParagraph) {
      scenes.push({ startParagraph, endParagraph });
    }
  }
  return scenes;
}

/**
 * Single scene covering the whole chapter (no subdivision).
 */
export function getSingleScene(content: string): Scene[] {
  const paragraphs = getParagraphs(content);
  if (paragraphs.length === 0) return [];
  return [{ startParagraph: 0, endParagraph: paragraphs.length - 1 }];
}

/**
 * Get scenes for a chapter. Default: regex-based. Option to use LLM later.
 */
export function getScenes(
  content: string,
  options: { method?: "regex" | "single" } = {}
): Scene[] {
  const method = options.method ?? "regex";
  if (method === "single") return getSingleScene(content);
  return getScenesFromRegex(content);
}
