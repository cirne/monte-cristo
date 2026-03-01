#!/usr/bin/env bun
/**
 * Generate scene images. Uses scene text → LLM → image prompt, then shared
 * image-gen to produce WebP. Prompts are stored in data/scene-image-prompts.json.
 * By default only generates images that don't already exist.
 *
 * Usage:
 *   bun run scripts/generate-scene-images.ts --scene=1-0
 *   bun run scripts/generate-scene-images.ts --chapter=1
 *   bun run scripts/generate-scene-images.ts --all-scenes
 *   bun run scripts/generate-scene-images.ts --all-scenes --workers=5
 *   bun run scripts/generate-scene-images.ts --scene=1-0 --force
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { requireOpenAIClient } from "../lib/openai";
import { getScenes, getParagraphs } from "../lib/scenes";
import { loadStyle, buildFullPrompt, generateImageToWebPBuffer } from "../lib/image-gen";

const ROOT = join(import.meta.dir, "..");
const DATA_DIR = join(ROOT, "data");
const BOOK_PATH = join(DATA_DIR, "book.json");
const SCENE_PROMPTS_PATH = join(DATA_DIR, "scene-image-prompts.json");
const PUBLIC_SCENES = join(ROOT, "public", "images", "scenes");
const MAX_SCENE_TEXT_CHARS = 4000;

function loadBook(): { chapters: Array<{ number: number; content: string }> } {
  if (!existsSync(BOOK_PATH)) throw new Error(`Missing ${BOOK_PATH}. Run parse-book first.`);
  return JSON.parse(readFileSync(BOOK_PATH, "utf-8"));
}

function loadScenePrompts(): Record<string, string> {
  if (!existsSync(SCENE_PROMPTS_PATH)) return {};
  return JSON.parse(readFileSync(SCENE_PROMPTS_PATH, "utf-8")) as Record<string, string>;
}

function saveScenePrompts(prompts: Record<string, string>): void {
  writeFileSync(SCENE_PROMPTS_PATH, JSON.stringify(prompts, null, 2));
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

/** Call LLM to turn scene text into a single image-generation prompt. */
async function generateSceneImagePrompt(
  sceneText: string,
  style: string,
  chapterNumber: number,
  sceneIndex: number
): Promise<string> {
  const openai = requireOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You write a single image-generation prompt for DALL·E that illustrates this scene from "The Count of Monte Cristo".
Use the style guide below. Focus on what can be seen: setting, lighting, characters' positions and dress, atmosphere.
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

async function main() {
  const args = process.argv.slice(2);
  const sceneArg = args.find((a) => a.startsWith("--scene="))?.split("=")[1];
  const chapterArg = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const allScenes = args.includes("--all-scenes");
  const force = args.includes("--force");
  const workersArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const workers = workersArg ? Math.max(1, parseInt(workersArg, 10)) : 5;

  if (!sceneArg && !chapterArg && !allScenes) {
    console.error(
      "Usage: bun run scripts/generate-scene-images.ts --scene=CHAPTER-SCENE | --chapter=N | --all-scenes [--force] [--workers=N]"
    );
    console.error("Example: --scene=1-0 for chapter 1 scene 0; --chapter=2 for all scenes in chapter 2");
    process.exit(1);
  }

  const book = loadBook();
  const style = loadStyle(ROOT);
  let scenePrompts = loadScenePrompts();

  type SceneWork = {
    chapterNumber: number;
    sceneIndex: number;
    key: string;
    prompt: string;
  };

  const workItems: SceneWork[] = [];

  if (sceneArg) {
    const [chStr, sceneStr] = sceneArg.split("-");
    const chapterNumber = parseInt(chStr ?? "", 10);
    const sceneIndex = parseInt(sceneStr ?? "", 10);
    if (isNaN(chapterNumber) || isNaN(sceneIndex)) {
      console.error("Invalid --scene=CHAPTER-SCENE (e.g. 1-0)");
      process.exit(1);
    }
    const chapter = book.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) {
      console.error(`Chapter ${chapterNumber} not found`);
      process.exit(1);
    }
    const scenes = getScenes(chapter.content);
    if (sceneIndex < 0 || sceneIndex >= scenes.length) {
      console.error(`Scene ${sceneIndex} not found in chapter ${chapterNumber} (has ${scenes.length} scenes)`);
      process.exit(1);
    }
    const key = sceneKey(chapterNumber, sceneIndex);
    let prompt = scenePrompts[key];
    if (!prompt) {
      console.log(`Generating prompt for ${key}...`);
      const scene = scenes[sceneIndex];
      const sceneText = getSceneText(chapter.content, scene.startParagraph, scene.endParagraph);
      prompt = await generateSceneImagePrompt(sceneText, style, chapterNumber, sceneIndex);
      scenePrompts[key] = prompt;
      saveScenePrompts(scenePrompts);
      console.log(`Saved prompt for ${key}`);
    }
    const outPath = join(PUBLIC_SCENES, `${key}.webp`);
    if (existsSync(outPath) && !force) {
      console.log(`Skip ${key}: already exists`);
      return;
    }
    workItems.push({ chapterNumber, sceneIndex, key, prompt });
  } else if (chapterArg) {
    const chapterNumber = parseInt(chapterArg, 10);
    if (isNaN(chapterNumber) || chapterNumber < 1) {
      console.error("Invalid --chapter=N (use a positive chapter number)");
      process.exit(1);
    }
    const chapter = book.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) {
      console.error(`Chapter ${chapterNumber} not found`);
      process.exit(1);
    }
    const scenes = getScenes(chapter.content);
    for (let i = 0; i < scenes.length; i++) {
      const key = sceneKey(chapter.number, i);
      const outPath = join(PUBLIC_SCENES, `${key}.webp`);
      if (existsSync(outPath) && !force) continue;
      let prompt = scenePrompts[key];
      if (!prompt) {
        console.log(`Generating prompt for ${key}...`);
        const scene = scenes[i];
        const sceneText = getSceneText(chapter.content, scene.startParagraph, scene.endParagraph);
        prompt = await generateSceneImagePrompt(sceneText, style, chapter.number, i);
        scenePrompts[key] = prompt;
        saveScenePrompts(scenePrompts);
        console.log(`Saved prompt for ${key}`);
      }
      workItems.push({ chapterNumber: chapter.number, sceneIndex: i, key, prompt });
    }
  } else {
    for (const chapter of book.chapters) {
      const scenes = getScenes(chapter.content);
      for (let i = 0; i < scenes.length; i++) {
        const key = sceneKey(chapter.number, i);
        const outPath = join(PUBLIC_SCENES, `${key}.webp`);
        if (existsSync(outPath) && !force) continue;
        let prompt = scenePrompts[key];
        if (!prompt) {
          const scene = scenes[i];
          const sceneText = getSceneText(chapter.content, scene.startParagraph, scene.endParagraph);
          prompt = await generateSceneImagePrompt(sceneText, style, chapter.number, i);
          scenePrompts[key] = prompt;
          saveScenePrompts(scenePrompts);
        }
        workItems.push({ chapterNumber: chapter.number, sceneIndex: i, key, prompt });
      }
    }
  }

  if (workItems.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  if (!existsSync(PUBLIC_SCENES)) {
    mkdirSync(PUBLIC_SCENES, { recursive: true });
  }

  console.log(`Generating ${workItems.length} scene image(s) with ${workers} workers...`);
  for (let i = 0; i < workItems.length; i += workers) {
    const chunk = workItems.slice(i, i + workers);
    await Promise.all(
      chunk.map(async ({ key, prompt }) => {
        const fullPrompt = buildFullPrompt(prompt, style);
        const webp = await generateImageToWebPBuffer(fullPrompt);
        const outPath = join(PUBLIC_SCENES, `${key}.webp`);
        writeFileSync(outPath, webp);
        console.log(`Wrote ${outPath}`);
      })
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
