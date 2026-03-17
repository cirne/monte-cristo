#!/usr/bin/env bun
/**
 * Generate entity and/or scene images. By default only generates images that
 * don't already exist. With --chapter=N (and no --scenes-only/--entities-only),
 * generates all images for that chapter (entities + scenes). Use --scenes-only
 * or --entities-only to restrict to one type.
 *
 * Entity images: data/<book>/entity-image-prompts.json, image-style.txt.
 * Scene images: data/<book>/scene-image-prompts.json, chapter index scenes.
 * Images: public/images/entities/<book>/ and public/images/scenes/<book>/.
 *
 * Usage:
 *   bun run scripts/generate-images.ts --book=monte-cristo --chapter=1
 *   bun run scripts/generate-images.ts --book=gatsby --chapter=1 --scenes-only
 *   bun run scripts/generate-images.ts --book=monte-cristo --chapter=2 --entities-only
 *   bun run scripts/generate-images.ts --book=monte-cristo --entity=dantes
 *   bun run scripts/generate-images.ts --book=gatsby --scene=1-0
 *   bun run scripts/generate-images.ts --book=monte-cristo --all-entities
 *   bun run scripts/generate-images.ts --book=monte-cristo --all-scenes
 *   bun run scripts/generate-images.ts --book=monte-cristo [--force] [--workers=N]
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireOpenAIClient } from "../lib/openai";
import { createChatCompletion } from "../lib/llm";
import { loadStyle, buildFullPrompt, generateImageToWebPBuffer, ContentPolicyError } from "../lib/image-gen";
import { getChapterIndexEntry } from "../lib/chapter-index";
import { DEFAULT_BOOK_SLUG, getBookConfig, isBookSlug } from "../lib/books";
import { getBook } from "../lib/book";
import { getParagraphs } from "../lib/scenes";
import type { SceneWithDetails } from "../lib/scenes";

const ROOT = join(import.meta.dir, "..");
const MAX_SCENE_TEXT_CHARS = 4000;

const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT;
const SPACES_BUCKET = process.env.SPACES_BUCKET || "monte-cristo";
const SPACES_ACCESS_KEY_ID = process.env.SPACES_ACCESS_KEY_ID;
const SPACES_SECRET_ACCESS_KEY = process.env.SPACES_SECRET_ACCESS_KEY;

const s3Client =
  SPACES_ENDPOINT && SPACES_ACCESS_KEY_ID && SPACES_SECRET_ACCESS_KEY
    ? new S3Client({
        endpoint: "https://sfo3.digitaloceanspaces.com",
        region: "us-east-1",
        credentials: {
          accessKeyId: SPACES_ACCESS_KEY_ID,
          secretAccessKey: SPACES_SECRET_ACCESS_KEY,
        },
        forcePathStyle: false,
      })
    : null;

async function uploadToSpaces(key: string, body: Buffer) {
  if (!s3Client) return;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: SPACES_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
        ACL: "public-read",
      })
    );
    console.log(`Uploaded to Spaces: ${key}`);
  } catch (e) {
    console.error(`Failed to upload to Spaces: ${key}`, e);
  }
}

function dataDirFor(slug: string): string {
  return join(ROOT, "data", slug);
}

// --- Entity helpers ---

function loadEntityPrompts(slug: string): Record<string, string> {
  const path = join(dataDirFor(slug), "entity-image-prompts.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
}

function saveEntityPrompts(slug: string, prompts: Record<string, string>): void {
  writeFileSync(join(dataDirFor(slug), "entity-image-prompts.json"), JSON.stringify(prompts, null, 2));
}

interface StoredEntity {
  id: string;
  name: string;
  type: string;
  spoilerFreeIntro?: string;
}

function loadEntityStore(slug: string): Record<string, StoredEntity> {
  const path = join(dataDirFor(slug), "entity-store.json");
  if (!existsSync(path)) return {};
  const data = JSON.parse(readFileSync(path, "utf-8")) as { entities?: Record<string, StoredEntity> };
  return data.entities ?? {};
}

async function generateEntityImagePrompt(
  entity: StoredEntity,
  bookTitle: string,
  imageStyleHint?: string
): Promise<string> {
  const openai = requireOpenAIClient();
  const context = entity.spoilerFreeIntro
    ? `First appearance context: ${entity.spoilerFreeIntro.replace(/^"|"$/g, "").trim()}`
    : `Entity: ${entity.name}, type: ${entity.type}.`;
  const styleHint =
    imageStyleHint?.trim() ||
    "Period-appropriate to the story; fine-art illustration style, dignified, like a classic novel.";
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You write a single image-generation prompt for DALL·E that illustrates this ${entity.type} from "${bookTitle}".
${styleHint}
For a person: describe appearance, dress, expression. For a place or event: describe the setting, atmosphere.
Output only the image prompt, no explanation. One paragraph, under 200 words.`,
      },
      {
        role: "user",
        content: `${entity.name} (${entity.type}). ${context}`,
      },
    ],
    max_tokens: 200,
  });
  const prompt = response.choices[0]?.message?.content?.trim();
  if (!prompt) throw new Error(`Empty LLM response for entity ${entity.id}`);
  return prompt;
}

// --- Scene helpers ---

function loadScenePrompts(slug: string): Record<string, string> {
  const path = join(dataDirFor(slug), "scene-image-prompts.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
}

function saveScenePrompts(slug: string, prompts: Record<string, string>): void {
  writeFileSync(join(dataDirFor(slug), "scene-image-prompts.json"), JSON.stringify(prompts, null, 2));
}

function getSceneText(content: string, startParagraph: number, endParagraph: number): string {
  const paragraphs = getParagraphs(content);
  const slice = paragraphs.slice(startParagraph, endParagraph + 1);
  let text = slice.join("\n\n");
  if (text.length > MAX_SCENE_TEXT_CHARS) {
    text = text.slice(0, MAX_SCENE_TEXT_CHARS) + "\n\n[...]";
  }
  return text;
}

async function generateSceneImagePrompt(
  sceneText: string,
  style: string,
  chapterNumber: number,
  sceneIndex: number,
  bookTitle: string,
  imageStyleHint?: string
): Promise<string> {
  const styleHint =
    imageStyleHint?.trim() ||
    "Period-appropriate to the story; fine-art illustration style, dignified, like a classic novel.";
  const response = await createChatCompletion({
    messages: [
      {
        role: "system",
        content: `You write a single image-generation prompt for DALL·E that illustrates this scene from "${bookTitle}".
Use the style guide below. ${styleHint}
Focus on what can be seen: setting, lighting, characters' positions and dress, atmosphere.
Strip out or compress dialogue and non-visual narrative. Output only the image prompt, no explanation.`,
      },
      {
        role: "user",
        content: `Style guide:\n${style}\n\n---\nScene text (Chapter ${chapterNumber}, scene ${sceneIndex}):\n\n${sceneText}`,
      },
    ],
    max_tokens: 300,
  });

  const prompt = response.choices[0]?.message?.content?.trim();
  if (!prompt) throw new Error("Empty LLM response for scene prompt");
  return prompt;
}

function sceneKey(chapterNumber: number, sceneIndex: number): string {
  return `ch${chapterNumber}-scene${sceneIndex}`;
}

function getSceneCount(bookSlug: string, chapterNumber: number): number {
  const indexEntry = getChapterIndexEntry(bookSlug, chapterNumber);
  return indexEntry?.scenes?.length ?? 0;
}

async function getPromptForScene(
  bookSlug: string,
  bookTitle: string,
  imageStyleHint: string | undefined,
  chapterNumber: number,
  content: string,
  sceneIndex: number,
  style: string,
  scenePrompts: Record<string, string>
): Promise<{ key: string; prompt: string; fromIndex?: boolean }> {
  const indexEntry = getChapterIndexEntry(bookSlug, chapterNumber);
  const scenes = indexEntry?.scenes;
  if (!scenes?.length || sceneIndex >= scenes.length) {
    throw new Error(`Scene ${sceneIndex} not found (chapter has ${scenes?.length ?? 0} scenes in index)`);
  }
  const scene = scenes[sceneIndex] as SceneWithDetails;
  const key = sceneKey(chapterNumber, sceneIndex);

  if (scenePrompts[key]) {
    return { key, prompt: scenePrompts[key] };
  }
  if (scene.imageDescription) {
    return { key, prompt: scene.imageDescription, fromIndex: true };
  }
  const sceneText = getSceneText(content, scene.startParagraph, scene.endParagraph);
  const prompt = await generateSceneImagePrompt(
    sceneText,
    style,
    chapterNumber,
    sceneIndex,
    bookTitle,
    imageStyleHint
  );
  return { key, prompt };
}

async function getScenesAndPrompt(
  bookSlug: string,
  bookTitle: string,
  imageStyleHint: string | undefined,
  chapterNumber: number,
  content: string,
  sceneIndex: number,
  style: string,
  scenePrompts: Record<string, string>,
  saveScenePrompts: (p: Record<string, string>) => void
): Promise<{ startParagraph: number; endParagraph: number; prompt: string }> {
  const indexEntry = getChapterIndexEntry(bookSlug, chapterNumber);
  const scenes = indexEntry?.scenes;
  if (!scenes?.length || sceneIndex >= scenes.length) {
    throw new Error(`Scene ${sceneIndex} not found (chapter has ${scenes?.length ?? 0} scenes in index)`);
  }

  const scene = scenes[sceneIndex] as SceneWithDetails;
  const key = sceneKey(chapterNumber, sceneIndex);

  let prompt = scenePrompts[key];
  if (!prompt && scene.imageDescription) {
    prompt = scene.imageDescription;
    scenePrompts[key] = prompt;
    saveScenePrompts(scenePrompts);
    console.log(`Using index imageDescription for ${key}`);
  }
  if (!prompt) {
    console.log(`Generating prompt for ${key}...`);
    const sceneText = getSceneText(content, scene.startParagraph, scene.endParagraph);
    prompt = await generateSceneImagePrompt(
      sceneText,
      style,
      chapterNumber,
      sceneIndex,
      bookTitle,
      imageStyleHint
    );
    scenePrompts[key] = prompt;
    saveScenePrompts(scenePrompts);
  }

  return {
    startParagraph: scene.startParagraph,
    endParagraph: scene.endParagraph,
    prompt,
  };
}

async function runEntityImages(
  bookSlug: string,
  bookTitle: string,
  imageStyleHint: string | undefined,
  publicEntitiesDir: string,
  style: string,
  entityId: string | null,
  chapterNum: number | null,
  allEntities: boolean,
  force: boolean,
  concurrency: number
): Promise<void> {
  const prompts = loadEntityPrompts(bookSlug);
  const store = loadEntityStore(bookSlug);
  const savePrompts = (p: Record<string, string>) => saveEntityPrompts(bookSlug, p);

  let entityIds: string[];
  if (chapterNum != null && !isNaN(chapterNum)) {
    const entry = getChapterIndexEntry(bookSlug, chapterNum);
    if (!entry?.entities?.length) {
      console.error(`Chapter ${chapterNum} has no entities in the index. Run index-chapter first.`);
      return;
    }
    entityIds = [...new Set(entry.entities.map((e) => e.entityId))];
    const needPromptItems: { id: string; entity: StoredEntity }[] = [];
    for (const id of entityIds) {
      if (prompts[id]) continue;
      const entity = store[id];
      if (!entity) {
        console.warn(`Skipping ${id}: not in entity store`);
        continue;
      }
      needPromptItems.push({ id, entity });
    }
    if (needPromptItems.length > 0) {
      console.log(`Generating ${needPromptItems.length} entity prompt(s) with ${concurrency} workers...`);
      for (let i = 0; i < needPromptItems.length; i += concurrency) {
        const chunk = needPromptItems.slice(i, i + concurrency);
        const results = await Promise.all(
          chunk.map(async ({ id, entity }) => {
            try {
              const prompt = await generateEntityImagePrompt(entity, bookTitle, imageStyleHint);
              return { id, prompt };
            } catch (e) {
              console.warn(`Failed to generate prompt for ${id}:`, (e as Error).message);
              return null;
            }
          })
        );
        for (const r of results) {
          if (r) prompts[r.id] = r.prompt;
        }
        savePrompts(prompts);
      }
    }
  } else {
    entityIds = entityId ? [entityId] : Object.keys(prompts);
  }

  const workItems: { id: string; fullPrompt: string }[] = [];
  for (const id of entityIds) {
    const prompt = prompts[id];
    if (!prompt) {
      console.warn(`Skipping ${id}: no prompt in entity-image-prompts.json`);
      continue;
    }
    const outPath = join(publicEntitiesDir, `${id}.webp`);
    if (existsSync(outPath) && !force) {
      console.log(`Skip ${id}: already exists`);
      continue;
    }
    workItems.push({ id, fullPrompt: buildFullPrompt(prompt, style) });
  }

  if (workItems.length === 0) {
    console.log("No entity images to generate.");
    return;
  }

  if (!existsSync(publicEntitiesDir)) {
    mkdirSync(publicEntitiesDir, { recursive: true });
  }

  console.log(`Generating ${workItems.length} entity image(s) with ${concurrency} workers...`);
  for (let i = 0; i < workItems.length; i += concurrency) {
    const chunk = workItems.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ id, fullPrompt }) => {
        try {
          const webp = await generateImageToWebPBuffer(fullPrompt);
          const outPath = join(publicEntitiesDir, `${id}.webp`);
          writeFileSync(outPath, webp);
          console.log(`Wrote ${outPath}`);
          await uploadToSpaces(`entities/${bookSlug}/${id}.webp`, webp);
        } catch (e) {
          const isContentPolicy =
            e instanceof ContentPolicyError ||
            (e instanceof Error && e.message.toLowerCase().includes("content_policy_violation"));
          if (isContentPolicy) {
            console.log(`Skip ${id}: content policy (safety)`);
            return;
          }
          throw e;
        }
      })
    );
  }
}

type SceneWork = { chapterNumber: number; sceneIndex: number; key: string; prompt: string };

async function runSceneImages(
  bookSlug: string,
  bookTitle: string,
  imageStyleHint: string | undefined,
  publicScenesDir: string,
  style: string,
  sceneArg: string | null,
  chapterNum: number | null,
  allScenes: boolean,
  force: boolean,
  workers: number
): Promise<void> {
  const book = getBook(bookSlug);
  if (!book) {
    console.error(`Missing data for ${bookSlug}. Run parse-book first.`);
    return;
  }
  const scenePrompts = loadScenePrompts(bookSlug);
  const saveScenePromptsForBook = (p: Record<string, string>) => saveScenePrompts(bookSlug, p);

  const workItems: SceneWork[] = [];

  if (sceneArg) {
    const [chStr, sceneStr] = sceneArg.split("-");
    const chapterNumber = parseInt(chStr ?? "", 10);
    const sceneIndex = parseInt(sceneStr ?? "", 10);
    if (isNaN(chapterNumber) || isNaN(sceneIndex)) {
      console.error("Invalid --scene=CHAPTER-SCENE (e.g. 1-0)");
      return;
    }
    const chapter = book.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) {
      console.error(`Chapter ${chapterNumber} not found`);
      return;
    }
    const sceneCount = getSceneCount(bookSlug, chapterNumber);
    if (sceneIndex < 0 || sceneIndex >= sceneCount) {
      console.error(`Scene ${sceneIndex} not found in chapter ${chapterNumber} (has ${sceneCount} scenes)`);
      return;
    }
    const key = sceneKey(chapterNumber, sceneIndex);
    const { prompt } = await getScenesAndPrompt(
      bookSlug,
      bookTitle,
      imageStyleHint,
      chapterNumber,
      chapter.content,
      sceneIndex,
      style,
      scenePrompts,
      saveScenePromptsForBook
    );
    const outPath = join(publicScenesDir, `${key}.webp`);
    if (existsSync(outPath) && !force) {
      console.log(`Skip ${key}: already exists`);
      return;
    }
    workItems.push({ chapterNumber, sceneIndex, key, prompt });
  } else if (chapterNum != null && !isNaN(chapterNum)) {
    const chapter = book.chapters.find((c) => c.number === chapterNum);
    if (!chapter) {
      console.error(`Chapter ${chapterNum} not found`);
      return;
    }
    const sceneCount = getSceneCount(bookSlug, chapter.number);
    const needItems: { chapterNumber: number; sceneIndex: number; content: string }[] = [];
    for (let i = 0; i < sceneCount; i++) {
      const key = sceneKey(chapter.number, i);
      const outPath = join(publicScenesDir, `${key}.webp`);
      if (existsSync(outPath) && !force) continue;
      needItems.push({ chapterNumber: chapter.number, sceneIndex: i, content: chapter.content });
    }
    if (needItems.length > 0) {
      console.log(`Resolving ${needItems.length} scene prompt(s) with ${workers} workers...`);
      for (let i = 0; i < needItems.length; i += workers) {
        const chunk = needItems.slice(i, i + workers);
        const results = await Promise.all(
          chunk.map((item) =>
            getPromptForScene(
              bookSlug,
              bookTitle,
              imageStyleHint,
              item.chapterNumber,
              item.content,
              item.sceneIndex,
              style,
              scenePrompts
            )
          )
        );
        for (const r of results) {
          scenePrompts[r.key] = r.prompt;
          if (r.fromIndex) console.log(`Using index imageDescription for ${r.key}`);
        }
        saveScenePromptsForBook(scenePrompts);
      }
    }
    for (const item of needItems) {
      const key = sceneKey(item.chapterNumber, item.sceneIndex);
      workItems.push({ chapterNumber: item.chapterNumber, sceneIndex: item.sceneIndex, key, prompt: scenePrompts[key]! });
    }
  } else {
    const needItems: { chapterNumber: number; sceneIndex: number; content: string }[] = [];
    for (const chapter of book.chapters) {
      const sceneCount = getSceneCount(bookSlug, chapter.number);
      for (let i = 0; i < sceneCount; i++) {
        const key = sceneKey(chapter.number, i);
        const outPath = join(publicScenesDir, `${key}.webp`);
        if (existsSync(outPath) && !force) continue;
        needItems.push({ chapterNumber: chapter.number, sceneIndex: i, content: chapter.content });
      }
    }
    if (needItems.length > 0) {
      console.log(`Resolving ${needItems.length} scene prompt(s) with ${workers} workers...`);
      for (let i = 0; i < needItems.length; i += workers) {
        const chunk = needItems.slice(i, i + workers);
        const results = await Promise.all(
          chunk.map((item) =>
            getPromptForScene(
              bookSlug,
              bookTitle,
              imageStyleHint,
              item.chapterNumber,
              item.content,
              item.sceneIndex,
              style,
              scenePrompts
            )
          )
        );
        for (const r of results) {
          scenePrompts[r.key] = r.prompt;
          if (r.fromIndex) console.log(`Using index imageDescription for ${r.key}`);
        }
        saveScenePromptsForBook(scenePrompts);
      }
    }
    for (const item of needItems) {
      const key = sceneKey(item.chapterNumber, item.sceneIndex);
      workItems.push({ chapterNumber: item.chapterNumber, sceneIndex: item.sceneIndex, key, prompt: scenePrompts[key]! });
    }
  }

  if (workItems.length === 0) {
    console.log("No scene images to generate.");
    return;
  }

  if (!existsSync(publicScenesDir)) {
    mkdirSync(publicScenesDir, { recursive: true });
  }

  console.log(`Generating ${workItems.length} scene image(s) with ${workers} workers...`);
  for (let i = 0; i < workItems.length; i += workers) {
    const chunk = workItems.slice(i, i + workers);
    await Promise.all(
      chunk.map(async ({ key, prompt }) => {
        try {
          const fullPrompt = buildFullPrompt(prompt, style);
          const webp = await generateImageToWebPBuffer(fullPrompt);
          const outPath = join(publicScenesDir, `${key}.webp`);
          writeFileSync(outPath, webp);
          console.log(`Wrote ${outPath}`);
          await uploadToSpaces(`scenes/${bookSlug}/${key}.webp`, webp);
        } catch (e) {
          const isContentPolicy =
            e instanceof ContentPolicyError ||
            (e instanceof Error && e.message.toLowerCase().includes("content_policy_violation"));
          if (isContentPolicy) {
            console.log(`Skip ${key}: content policy (safety)`);
            return;
          }
          throw e;
        }
      })
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const bookArg = args.find((a) => a.startsWith("--book="))?.split("=")[1]?.trim();
  const bookSlug = bookArg && isBookSlug(bookArg) ? bookArg : DEFAULT_BOOK_SLUG;
  const entityId = args.find((a) => a.startsWith("--entity="))?.split("=")[1] ?? null;
  const sceneArg = args.find((a) => a.startsWith("--scene="))?.split("=")[1] ?? null;
  const chapterArg = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const chapterNum = chapterArg ? parseInt(chapterArg, 10) : null;
  const allEntities = args.includes("--all-entities");
  const allScenes = args.includes("--all-scenes");
  const scenesOnly = args.includes("--scenes-only");
  const entitiesOnly = args.includes("--entities-only");
  const force = args.includes("--force");
  const concurrencyArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const concurrency = concurrencyArg ? Math.max(1, parseInt(concurrencyArg, 10)) : 32;

  const hasScope = entityId || allEntities || (chapterNum != null && !isNaN(chapterNum)) || sceneArg || allScenes;
  if (!hasScope) {
    console.error(
      "Usage: bun run scripts/generate-images.ts --book=<slug> [--chapter=N [--scenes-only | --entities-only] | --entity=<id> | --all-entities | --scene=CH-SCENE | --all-scenes] [--force] [--workers=N]"
    );
    console.error("  --chapter=N without flags generates all images (entities + scenes) for that chapter.");
    process.exit(1);
  }

  const config = getBookConfig(bookSlug)!;
  const bookTitle = config.title;
  const imageStyleHint = config.imageStyleHint;
  const publicEntitiesDir = join(ROOT, "public", "images", "entities", bookSlug);
  const publicScenesDir = join(ROOT, "public", "images", "scenes", bookSlug);

  const style = loadStyle(ROOT);

  const doEntities =
    entityId != null || allEntities || (chapterNum != null && !isNaN(chapterNum) && !scenesOnly);
  const doScenes =
    sceneArg != null || allScenes || (chapterNum != null && !isNaN(chapterNum) && !entitiesOnly);

  if (doEntities) {
    await runEntityImages(
      bookSlug,
      bookTitle,
      imageStyleHint,
      publicEntitiesDir,
      style,
      entityId,
      chapterNum ?? null,
      allEntities,
      force,
      concurrency
    );
  }

  if (doScenes) {
    await runSceneImages(
      bookSlug,
      bookTitle,
      imageStyleHint,
      publicScenesDir,
      style,
      sceneArg,
      chapterNum ?? null,
      allScenes,
      force,
      concurrency
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
