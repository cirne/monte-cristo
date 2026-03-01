/**
 * Shared image generation: style loading, prompt building, and DALL·E → WebP.
 * Used by generate-images.ts (entities) and generate-scene-images.ts (scenes).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { requireOpenAIClient } from "./openai";
import sharp from "sharp";

const DEFAULT_BASE = process.cwd();

export function getStylePath(basePath: string = DEFAULT_BASE): string {
  return join(basePath, "data", "image-style.txt");
}

/** Load the shared image style text from data/image-style.txt */
export function loadStyle(basePath: string = DEFAULT_BASE): string {
  const path = getStylePath(basePath);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Create it with the shared image style.`);
  }
  return readFileSync(path, "utf-8").trim();
}

/** Combine shared style with a specific image prompt (for DALL·E). */
export function buildFullPrompt(prompt: string, style: string): string {
  return `${style}\n\nImage prompt: ${prompt}`;
}

/** Generate one image from a full prompt (style + prompt already combined). Returns WebP buffer. */
export async function generateImageToWebPBuffer(fullPrompt: string): Promise<Buffer> {
  const openai = requireOpenAIClient();
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
    quality: "standard",
  });

  const b64 = response.data[0]?.b64_json;
  if (!b64) throw new Error("No image data in response");
  const pngBuffer = Buffer.from(b64, "base64");
  return sharp(pngBuffer)
    .webp({ quality: 82 })
    .toBuffer();
}
