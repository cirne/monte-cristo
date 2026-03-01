#!/usr/bin/env bun
/**
 * Generate entity and scene images. By default only generates images that
 * don't already exist. Uses data/image-style.txt and data/entity-image-prompts.json.
 * Runs multiple generations in parallel; default concurrency is 5 (safe for most
 * OpenAI tiers). Use --workers=32 if your account allows higher RPM.
 *
 * Usage:
 *   bun run scripts/generate-images.ts --entity dantes
 *   bun run scripts/generate-images.ts --all-entities
 *   bun run scripts/generate-images.ts --all-entities --workers=10
 *   bun run scripts/generate-images.ts --entity dantes --force
 */

import "../lib/loadEnv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { loadStyle, buildFullPrompt, generateImageToWebPBuffer } from "../lib/image-gen";

const ROOT = join(import.meta.dir, "..");
const DATA_DIR = join(ROOT, "data");
const PUBLIC_ENTITIES = join(ROOT, "public", "images", "entities");
const ENTITY_PROMPTS_PATH = join(DATA_DIR, "entity-image-prompts.json");

function loadEntityPrompts(): Record<string, string> {
  if (!existsSync(ENTITY_PROMPTS_PATH)) return {};
  return JSON.parse(readFileSync(ENTITY_PROMPTS_PATH, "utf-8")) as Record<string, string>;
}

async function main() {
  const args = process.argv.slice(2);
  const entityId = args.find((a) => a.startsWith("--entity="))?.split("=")[1];
  const allEntities = args.includes("--all-entities");
  const force = args.includes("--force");
  const concurrencyArg = args.find((a) => a.startsWith("--workers="))?.split("=")[1];
  const concurrency = concurrencyArg ? Math.max(1, parseInt(concurrencyArg, 10)) : 5;

  if (!entityId && !allEntities) {
    console.error(
      "Usage: bun run scripts/generate-images.ts --entity=<id> | --all-entities [--force] [--workers=N]"
    );
    process.exit(1);
  }

  const style = loadStyle(ROOT);
  const prompts = loadEntityPrompts();
  const entityIds = entityId ? [entityId] : Object.keys(prompts);

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
