import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateChatCompletion = vi.fn();

vi.mock("./llm", () => ({
  createFastChatCompletion: (...args: unknown[]) => mockCreateChatCompletion(...args),
}));

import {
  buildContextPrompt,
  coerceAnswerParagraphs,
  generateNarrativeAnswer,
  parseMaxInputTokensParam,
  parseNonNegativeIntParam,
  parsePositiveIntParam,
} from "./context-api";

describe("lib/context-api", () => {
  beforeEach(() => {
    mockCreateChatCompletion.mockReset();
  });

  it("parses query params for chapter and paragraph safely", () => {
    expect(parsePositiveIntParam("3")).toBe(3);
    expect(parsePositiveIntParam("0")).toBeNull();
    expect(parsePositiveIntParam(null)).toBeNull();

    expect(parseNonNegativeIntParam("0")).toBe(0);
    expect(parseNonNegativeIntParam("-1")).toBeNull();
    expect(parseNonNegativeIntParam(null)).toBeNull();

    expect(parseMaxInputTokensParam("45000")).toBe(45_000);
    expect(parseMaxInputTokensParam("10")).toBe(40_000);
  });

  it("fits context sections into token budget", () => {
    const prompt = buildContextPrompt(
      [
        { label: "Section A", content: "A".repeat(200) },
        { label: "Section B", content: "B".repeat(500) },
      ],
      120
    );

    expect(prompt.includedSections.length).toBeGreaterThan(0);
    expect(prompt.estimatedInputTokens).toBeLessThanOrEqual(120);
  });

  it("returns validated answer from LLM JSON response", async () => {
    mockCreateChatCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ answer: "A clear and valid context explanation." }) } }],
    });

    const out = await generateNarrativeAnswer({
      systemPrompt: "system",
      userPrompt: "user",
      fallbackAnswer: "fallback",
    });

    expect(out).toEqual({
      answer: "A clear and valid context explanation.",
      source: "llm",
    });
  });

  it("falls back when LLM output is invalid", async () => {
    mockCreateChatCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ answer: "tiny" }) } }],
    });

    const out = await generateNarrativeAnswer({
      systemPrompt: "system",
      userPrompt: "user",
      fallbackAnswer: "fallback answer with enough detail.",
    });

    expect(out).toEqual({
      answer: "fallback answer with enough detail.",
      source: "fallback",
    });
  });

  it("coerces exact paragraph count by splitting and merging", () => {
    const oneParagraph =
      "Sentence one is clear. Sentence two adds context. Sentence three extends the point. Sentence four lands it.";
    const exactTwo = coerceAnswerParagraphs(oneParagraph, { exact: 2 });
    const paras = exactTwo.split(/\n\s*\n+/);
    expect(paras).toHaveLength(2);
    expect(paras[0].length).toBeGreaterThan(10);
    expect(paras[1].length).toBeGreaterThan(10);

    const fourParagraphs = "A.\n\nB.\n\nC.\n\nD.";
    const maxThree = coerceAnswerParagraphs(fourParagraphs, { max: 3 });
    expect(maxThree.split(/\n\s*\n+/)).toHaveLength(3);
  });
});
