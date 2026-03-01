import { createChatCompletion } from "./llm";
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
    const completion = await createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
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
