/**
 * LLM-based scene delineation for index time only.
 * Analyzes a full chapter and returns scenes with location, image description,
 * and character IDs. Resolves start text fragments to paragraph indices.
 * Used by scripts/index-chapter.ts; not used by the webapp at runtime.
 */

import type { SceneWithDetails, EntityRefForScenes } from "./scenes";
import { getParagraphs } from "./scenes";
import { createChatCompletion } from "./llm";

const MAX_CHAPTER_CHARS = 55_000;

/** Raw scene from LLM response before resolving to paragraph indices */
interface LLMSceneItem {
  locationDescription: string;
  startTextFragment: string;
  imageDescription: string;
  characterIds?: string[];
}

function normalizeFragment(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 200);
}

/**
 * Find the 0-based paragraph index where the given fragment appears at the start
 * of a paragraph. Uses normalized comparison (collapse spaces, case-insensitive).
 */
function findParagraphIndexByFragment(paragraphs: string[], fragment: string): number {
  const normalizedFragment = normalizeFragment(fragment);
  if (!normalizedFragment) return 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const normalizedPara = normalizeFragment(para);
    // Fragment can be start of paragraph or paragraph can start with fragment
    if (
      normalizedPara.startsWith(normalizedFragment) ||
      normalizedFragment.startsWith(normalizedPara.slice(0, 80))
    ) {
      return i;
    }
    // Also check first ~100 chars of paragraph for fragment start
    const paraStart = normalizedPara.slice(0, 120);
    if (paraStart.includes(normalizedFragment.slice(0, 50))) {
      return i;
    }
  }

  // Fallback: find first paragraph that contains the fragment
  for (let i = 0; i < paragraphs.length; i++) {
    if (normalizeFragment(paragraphs[i]).includes(normalizedFragment.slice(0, 40))) {
      return i;
    }
  }
  return 0;
}

/**
 * Call LLM to analyze the chapter and break it into logical scenes.
 * Returns scenes with startParagraph/endParagraph resolved from startTextFragment.
 * entityRefs: list of { id, name, type } for entities in this chapter so the LLM
 * can return characterIds that match our canonical IDs.
 * bookTitle and imageStyleHint make prompts book-agnostic (used for scene location examples and image description style).
 */
export async function getScenesFromLLM(
  chapterNumber: number,
  content: string,
  entityRefs: EntityRefForScenes[],
  opts: { bookTitle: string; imageStyleHint?: string }
): Promise<SceneWithDetails[]> {
  const { bookTitle, imageStyleHint } = opts;
  const styleHint =
    imageStyleHint?.trim() ||
    "period-appropriate to the story; fine-art illustration style, dignified, like a classic novel.";

  const text = content.slice(0, MAX_CHAPTER_CHARS);
  if (content.length > MAX_CHAPTER_CHARS) {
    console.warn(
      `Chapter ${chapterNumber} truncated to ${MAX_CHAPTER_CHARS} chars for scene analysis.`
    );
  }

  const personList = entityRefs.filter((e) => e.type === "person");
  const entityListText =
    personList.length > 0
      ? personList.map((e) => `- ${e.id}: ${e.name}`).join("\n")
      : "No character list provided.";

  const systemPrompt = `You analyze a single chapter of "${bookTitle}" and split it into logical scenes.
A new scene usually starts when the location or setting changes (e.g. moving from one place to another, or to a different room), or when there is a clear time jump.

For each scene you must provide:
1. locationDescription: A short phrase for the setting (e.g. "On the ship's deck", "In the protagonist's room", "At the mansion").
2. startTextFragment: The exact first 6–12 words that begin this scene in the chapter text. This must appear verbatim (or nearly so) in the chapter so we can locate the scene. Use the opening sentence of the scene.
3. imageDescription: A single paragraph description suitable for generating an illustration with DALL·E: setting, lighting, who is present and their positions, period-appropriate dress, atmosphere. No dialogue or non-visual detail. Style: ${styleHint}
4. characterIds: An array of entity IDs from the list below for characters (persons) who appear or are clearly present in this scene. Use only IDs from the list. Omit if none apply.

Return a JSON object with a single key "scenes" whose value is an array of objects, each with: locationDescription, startTextFragment, imageDescription, characterIds (array of strings). Order scenes in the same order they appear in the chapter.`;

  const userPrompt = `Chapter ${chapterNumber} — entities to reference by ID in characterIds (use only these exact IDs):
${entityListText}

---

Chapter text:

${text}`;

  const response = await createChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 16384,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty LLM response for scene analysis");

  let parsed: { scenes?: LLMSceneItem[] };
  try {
    parsed = JSON.parse(raw) as { scenes?: LLMSceneItem[] };
  } catch (e) {
    throw new Error(`Invalid JSON from scene LLM: ${(e as Error).message}`);
  }

  const items = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  if (items.length === 0) {
    throw new Error("LLM returned no scenes");
  }

  const paragraphs = getParagraphs(content);
  const scenes: SceneWithDetails[] = [];
  const knownIds = new Set(entityRefs.map((e) => e.id.toLowerCase()));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const startParagraph = findParagraphIndexByFragment(
      paragraphs,
      item.startTextFragment?.trim() || ""
    );
    const endParagraph =
      i + 1 < items.length
        ? findParagraphIndexByFragment(paragraphs, items[i + 1].startTextFragment?.trim() || "") - 1
        : paragraphs.length - 1;

    const characterIds =
      Array.isArray(item.characterIds) &&
      item.characterIds.length > 0
        ? item.characterIds.filter((id) => knownIds.has(String(id).toLowerCase()))
        : undefined;

    scenes.push({
      startParagraph: Math.max(0, startParagraph),
      endParagraph: Math.min(paragraphs.length - 1, Math.max(startParagraph, endParagraph)),
      locationDescription: item.locationDescription?.trim() || undefined,
      imageDescription: item.imageDescription?.trim() || undefined,
      characterIds: characterIds?.length ? characterIds : undefined,
    });
  }

  return scenes;
}
