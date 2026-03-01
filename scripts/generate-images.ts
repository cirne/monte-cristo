#!/usr/bin/env bun
/**
 * Generate entity images. By default only generates images that
 * don't already exist. Uses data/image-style.txt and data/entity-image-prompts.json.
 * With --chapter=N, ensures prompts exist for entities in that chapter (from entity store, via LLM), then generates images.
 * Runs multiple generations in parallel; default concurrency is 32.
 *
 * Usage:
 *   bun run scripts/generate-images.ts --entity=dantes
 *   bun run scripts/generate-images.ts --chapter=1
 *   bun run scripts/generate-images.ts --all-entities
 *   bun run scripts/generate-images.ts --all-entities --workers=10
 *   bun run scripts/generate-images.ts --entity dantes --force
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { requireOpenAIClient } from "../lib/openai";
import { loadStyle, buildFullPrompt, generateImageToWebPBuffer } from "../lib/image-gen";
import { getChapterIndexEntry } from "../lib/chapter-index";

const ROOT = join(import.meta.dir, "..");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_ENTITIES = join(ROOT, "public", "images", "entities");
const ENTITY_PROMPTS_PATH = join(DATA_DIR, "entity-image-prompts.json");
const ENTITY_STORE_PATH = join(DATA_DIR, "entity-store.json");

function loadEntityPrompts(): Record<string, string> {
  if (!existsSync(ENTITY_PROMPTS_PATH)) return {};
  return JSON.parse(readFileSync(ENTITY_PROMPTS_PATH, "utf-8")) as Record<string, string>;
}

function saveEntityPrompts(prompts: Record<string, string>): void {
  writeFileSync(ENTITY_PROMPTS_PATH, JSON.stringify(prompts, null, 2));
}

interface StoredEntity {
  id: string;
  name: string;
  type: string;
  spoilerFreeIntro?: string;
}

function loadEntityStore(): Record<string, StoredEntity> {
  if (!existsSync(ENTITY_STORE_PATH)) return {};
  const data = JSON.parse(readFileSync(ENTITY_STORE_PATH, "utf-8")) as { entities?: Record<string, StoredEntity> };
  return data.entities ?? {};
}

/** Generate an image prompt for an entity using name, type, and spoiler-free intro. */
async function generateEntityImagePrompt(entity: StoredEntity): Promise<string> {
  const openai = requireOpenAIClient();
  const context = entity.spoilerFreeIntro
    ? `First appearance context: ${entity.spoilerFreeIntro.replace(/^"|"$/g, "").trim()}`
    : `Entity: ${entity.name}, type: ${entity.type}.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You write a single image-generation prompt for DALL·E that illustrates this ${entity.type} from "The Count of Monte Cristo".
For a person: describe appearance, dress, expression, period-appropriate (early 19th century). For a place or event: describe the setting, atmosphere, period-accurate detail.
Output only the image prompt, no explanation. Fine-art illustration style, dignified, like a classic novel engraving. One paragraph, under 200 words.`,
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

async function main() {
  const args = process.argv.slice(2);
  const entityId = args.find((a) => a.startsWith("--entity="))?.split("=")[1];
  const chapterArg = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const chapterNum = chapterArg ? parseInt(chapterArg, 10) : null;
  const allEntities = args.includes("--all-entities");
  const force = args.includes("--force");
  const concurrencyArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const concurrency = concurrencyArg ? Math.max(1, parseInt(concurrencyArg, 10)) : 32;

  if (!entityId && !allEntities && chapterNum == null) {
    console.error(
      "Usage: bun run scripts/generate-images.ts --entity=<id> | --chapter=N | --all-entities [--force] [--workers=N]"
    );
    process.exit(1);
  }

  const style = loadStyle(ROOT);
  let prompts = loadEntityPrompts();
  const store = loadEntityStore();

  let entityIds: string[];
  if (chapterNum != null && !isNaN(chapterNum)) {
    const entry = getChapterIndexEntry(chapterNum);
    if (!entry?.entities?.length) {
      console.error(`Chapter ${chapterNum} has no entities in the index. Run index-chapter first.`);
      process.exit(1);
    }
    entityIds = [...new Set(entry.entities.map((e) => e.entityId))];
    for (const id of entityIds) {
      if (prompts[id]) continue;
      const entity = store[id];
      if (!entity) {
        console.warn(`Skipping ${id}: not in entity store`);
        continue;
      }
      console.log(`Generating prompt for ${id} (${entity.name})...`);
      try {
        prompts[id] = await generateEntityImagePrompt(entity);
        saveEntityPrompts(prompts);
      } catch (e) {
        console.warn(`Failed to generate prompt for ${id}:`, (e as Error).message);
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
    const outPath = join(PUBLIC_ENTITIES, `${id}.webp`);
    if (existsSync(outPath) && !force) {
      console.log(`Skip ${id}: already exists`);
      continue;
    }
    workItems.push({ id, fullPrompt: buildFullPrompt(prompt, style) });
  }

  if (workItems.length === 0) {
    console.log("Nothing to generate.");
    return;
  }

  if (!existsSync(PUBLIC_ENTITIES)) {
    mkdirSync(PUBLIC_ENTITIES, { recursive: true });
  }

  console.log(`Generating ${workItems.length} image(s) with ${concurrency} workers...`);
  for (let i = 0; i < workItems.length; i += concurrency) {
    const chunk = workItems.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ id, fullPrompt }) => {
        const webp = await generateImageToWebPBuffer(fullPrompt);
        const outPath = join(PUBLIC_ENTITIES, `${id}.webp`);
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
