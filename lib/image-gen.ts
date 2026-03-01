/**
 * Shared image generation: style loading, prompt building, and DALL·E → WebP.
 * Used by generate-images.ts (entities) and generate-scene-images.ts (scenes).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { requireOpenAIClient } from "./openai";
import sharp from "sharp";

const DEFAULT_BASE = process.cwd();

/** Thrown when DALL·E rejects the prompt due to content policy / safety (e.g. 400 content_policy_violation). */
export class ContentPolicyError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ContentPolicyError";
    Object.setPrototypeOf(this, ContentPolicyError.prototype);
  }
}

function isContentPolicyRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? String(err);
  if (status !== 400) return false;
  const codeMatch = code && String(code).toLowerCase().includes("content_policy");
  const msgMatch =
    typeof message === "string" &&
    (message.toLowerCase().includes("content_policy_violation") || message.toLowerCase().includes("content policy") || message.toLowerCase().includes("safety"));
  return Boolean(codeMatch || msgMatch);
}

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
  let response;
  try {
    response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard",
    });
  } catch (err) {
    if (isContentPolicyRejection(err)) {
      throw new ContentPolicyError("Content policy / safety rejection", err);
    }
    throw err;
  }

  const data = response.data;
  if (!data) throw new Error("No image data in response");
  const b64 = data[0]?.b64_json;
  if (!b64) throw new Error("No image data in response");
  const pngBuffer = Buffer.from(b64, "base64");
  return sharp(pngBuffer)
    .webp({ quality: 82 })
    .toBuffer();
}
