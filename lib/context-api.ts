import { createFastChatCompletion } from "./llm";
import { estimateTokens, trimToTokenBudget } from "./reading-context";

export const DEFAULT_MAX_INPUT_TOKENS = 40_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 700;
const MIN_VALID_ANSWER_CHARS = 24;

export interface ContextSection {
  label: string;
  content?: string;
}

export interface BuiltContextPrompt {
  text: string;
  estimatedInputTokens: number;
  includedSections: string[];
}

interface CoerceParagraphOptions {
  exact?: number;
  max?: number;
}

export function parsePositiveIntParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function parseNonNegativeIntParam(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parseMaxInputTokensParam(value: string | null): number {
  if (!value) return DEFAULT_MAX_INPUT_TOKENS;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 3_000) return DEFAULT_MAX_INPUT_TOKENS;
  return Math.min(n, 80_000);
}

export function buildContextPrompt(
  sections: ContextSection[],
  maxInputTokens: number,
  reservedOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS
): BuiltContextPrompt {
  const inputBudget = Math.min(
    Math.max(80, maxInputTokens),
    Math.max(80, maxInputTokens - reservedOutputTokens)
  );
  const includedSections: string[] = [];
  const lines: string[] = [];
  let usedTokens = 0;

  for (const section of sections) {
    const content = section.content?.trim();
    if (!content) continue;
    const heading = `${section.label}:`;
    const headingTokens = estimateTokens(heading);
    const available = inputBudget - usedTokens - headingTokens - 2;
    if (available <= 40) continue;
    const fitted = trimToTokenBudget(content, available);
    if (!fitted.trim()) continue;

    lines.push(heading, fitted, "");
    includedSections.push(section.label);
    usedTokens += headingTokens + estimateTokens(fitted) + 2;
    if (usedTokens >= inputBudget) break;
  }

  const text = lines.join("\n").trim();
  return {
    text,
    includedSections,
    estimatedInputTokens: estimateTokens(text),
  };
}

function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitParagraphInHalf(paragraph: string): [string, string] | null {
  const sentenceLike = paragraph.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (sentenceLike && sentenceLike.length >= 2) {
    const midpoint = Math.ceil(sentenceLike.length / 2);
    const first = sentenceLike
      .slice(0, midpoint)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const second = sentenceLike
      .slice(midpoint)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (first && second) return [first, second];
  }

  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length < 14) return null;
  const midpoint = Math.ceil(words.length / 2);
  const first = words.slice(0, midpoint).join(" ").trim();
  const second = words.slice(midpoint).join(" ").trim();
  if (!first || !second) return null;
  return [first, second];
}

/**
 * Normalize answer paragraph count without relying on brittle model behavior.
 * - exact: attempts to produce exactly N paragraphs by splitting/merging
 * - max: caps to at most N paragraphs by merging extras
 */
export function coerceAnswerParagraphs(text: string, options: CoerceParagraphOptions): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let paragraphs = splitParagraphs(trimmed);
  if (paragraphs.length === 0) return "";

  if (typeof options.exact === "number" && options.exact > 0) {
    const target = options.exact;
    if (paragraphs.length > target) {
      paragraphs = [
        ...paragraphs.slice(0, target - 1),
        paragraphs
          .slice(target - 1)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      ];
    }

    while (paragraphs.length < target) {
      const last = paragraphs[paragraphs.length - 1];
      const split = splitParagraphInHalf(last);
      if (!split) break;
      paragraphs = [...paragraphs.slice(0, -1), split[0], split[1]];
    }
  }

  if (typeof options.max === "number" && options.max > 0 && paragraphs.length > options.max) {
    paragraphs = [
      ...paragraphs.slice(0, options.max - 1),
      paragraphs
        .slice(options.max - 1)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    ];
  }

  return paragraphs.join("\n\n");
}

function extractAnswerFromResponse(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as { answer?: string; result?: string; summary?: string };
    const candidate = parsed.answer ?? parsed.result ?? parsed.summary;
    return typeof candidate === "string" ? candidate.trim() : undefined;
  } catch {
    return trimmed;
  }
}

function isValidAnswer(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length >= MIN_VALID_ANSWER_CHARS;
}

export async function generateNarrativeAnswer(params: {
  systemPrompt: string;
  userPrompt: string;
  fallbackAnswer: string;
  maxOutputTokens?: number;
}): Promise<{ answer: string; source: "llm" | "fallback" }> {
  const { systemPrompt, userPrompt, fallbackAnswer, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS } = params;
  try {
    const completion = await createFastChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxOutputTokens,
    });
    const raw = completion.choices[0]?.message?.content;
    const answer = extractAnswerFromResponse(raw);
    if (isValidAnswer(answer)) {
      return { answer, source: "llm" };
    }
  } catch {
    // Fall through to fallback response when LLM request fails.
  }
  return { answer: fallbackAnswer, source: "fallback" };
}
