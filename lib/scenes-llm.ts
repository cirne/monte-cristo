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
  imageSubtitle?: string;
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
 * Attempt to repair JSON truncated mid-string (common with "Unterminated string").
 * Finds the last complete scene object (ending with "},") and truncates there.
 */
function tryRepairTruncatedJson(raw: string, errMsg: string): string | null {
  if (!errMsg.toLowerCase().includes("unterminated") && !errMsg.toLowerCase().includes("unexpected end")) {
    return null;
  }
  const lastComplete = raw.trim().lastIndexOf('},');
  if (lastComplete < 0) return null;
  return raw.slice(0, lastComplete + 1) + ']}';
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
1. locationDescription: A short phrase for the setting (e.g. "On the deck of the Pharaon", "In Dantès' father's room"). Keep under 60 characters.
2. startTextFragment: The exact first 6–12 words that begin this scene in the chapter text. This must appear verbatim (or nearly so) in the chapter so we can locate the scene. Use the opening sentence of the scene.
3. imageDescription: A visually explicit description for DALL·E (2–3 sentences, under 100 words). CRITICAL: Never use character names—always describe people visually (e.g., "A 22-year-old handsome man in tattered prison garb" not "Dantes"). Include: age/appearance, clothing, setting details (time period, location specifics), lighting, positions, atmosphere. Be explicit and visually descriptive—assume the image generator knows nothing about the story. No dialogue or character names. Fine-art illustration style, 19th-century novel aesthetic.
4. imageSubtitle: A brief caption (1 short sentence, under 80 characters) suitable to display under the scene image. This should be spoiler-free and descriptive of what's happening in the scene. Can use character names here since it's for human readers. Examples: "Dantès receives news of his promotion" or "The Pharaon docks in Marseille".
5. characterIds: An array of entity IDs from the list below for characters (persons) who appear or are clearly present in this scene. Use only IDs from the list. Omit if none apply.

JSON rules: Return valid JSON only. Escape any double-quotes inside strings with backslash (e.g. \\"). Do not include newlines inside string values. Return a JSON object with a single key "scenes" whose value is an array of objects, each with: locationDescription, startTextFragment, imageDescription, imageSubtitle (optional), characterIds (array of strings). Order scenes in the same order they appear in the chapter.`;

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
    const errMsg = (e as Error).message;
    // Try to repair truncated JSON (common when max_tokens was hit or output cut off)
    const repaired = tryRepairTruncatedJson(raw, errMsg);
    if (repaired) {
      try {
        parsed = JSON.parse(repaired) as { scenes?: LLMSceneItem[] };
      } catch {
        throw new Error(`Invalid JSON from scene LLM: ${errMsg}`);
      }
    } else {
      throw new Error(`Invalid JSON from scene LLM: ${errMsg}`);
    }
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
      imageSubtitle: item.imageSubtitle?.trim() || undefined,
      characterIds: characterIds?.length ? characterIds : undefined,
    });
  }

  return scenes;
}
