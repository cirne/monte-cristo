import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreateChatCompletion = vi.fn();
const mockResolveReadingPosition = vi.fn();
const mockGetChapterSummaryWindowBefore = vi.fn();
const mockGetStorySoFarBeforeChapter = vi.fn();
const mockGetSceneSummariesBeforeCurrent = vi.fn();
const mockGetSceneTextUpToParagraph = vi.fn();

vi.mock("@/lib/llm", () => ({
  createFastChatCompletion: (...args: unknown[]) => mockCreateChatCompletion(...args),
}));

vi.mock("@/lib/reading-context", () => ({
  estimateTokens: (text: string) => Math.ceil(text.length / 4),
  trimToTokenBudget: (text: string) => text,
  resolveReadingPosition: (...args: unknown[]) => mockResolveReadingPosition(...args),
  getChapterSummaryWindowBefore: (...args: unknown[]) => mockGetChapterSummaryWindowBefore(...args),
  getStorySoFarBeforeChapter: (...args: unknown[]) => mockGetStorySoFarBeforeChapter(...args),
  getSceneSummariesBeforeCurrent: (...args: unknown[]) => mockGetSceneSummariesBeforeCurrent(...args),
  getSceneTextUpToParagraph: (...args: unknown[]) => mockGetSceneTextUpToParagraph(...args),
}));

import { GET } from "./route";

describe("app/api/context/current-scene/route", () => {
  beforeEach(() => {
    mockCreateChatCompletion.mockReset();
    mockResolveReadingPosition.mockReset();
    mockGetChapterSummaryWindowBefore.mockReset();
    mockGetStorySoFarBeforeChapter.mockReset();
    mockGetSceneSummariesBeforeCurrent.mockReset();
    mockGetSceneTextUpToParagraph.mockReset();
  });

  it("returns 400 for invalid params", async () => {
    const request = new NextRequest("http://localhost/api/context/current-scene?chapter=1");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns current scene answer and context metadata", async () => {
    mockResolveReadingPosition.mockReturnValue({
      chapterNumber: 3,
      paragraphIndex: 10,
      paragraphs: ["p0", "p1"],
      scenes: [{ startParagraph: 0, endParagraph: 12, locationDescription: "the harbor" }],
      sceneIndex: 0,
      scene: { startParagraph: 0, endParagraph: 12, locationDescription: "the harbor" },
    });
    mockGetChapterSummaryWindowBefore.mockReturnValue([
      "Chapter 1: Earlier setup.",
      "Chapter 2: Consequences start.",
    ]);
    mockGetStorySoFarBeforeChapter.mockReturnValue("Earlier events summarized.");
    mockGetSceneSummariesBeforeCurrent.mockReturnValue(["Scene 1: Setup."]);
    mockGetSceneTextUpToParagraph.mockReturnValue("Current scene excerpt.");
    mockCreateChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              answer:
                "The current scene is tense and focused on arrival. Important details are being exchanged among the people present. Their tone suggests urgency around what happens next. The atmosphere remains uneasy even as the conversation continues.",
            }),
          },
        },
      ],
    });

    const request = new NextRequest(
      "http://localhost/api/context/current-scene?chapter=3&paragraph=10&maxInputTokens=12000"
    );
    const response = await GET(request);
    const data = await response.json();
    const paragraphs = String(data.answer).split(/\n\s*\n+/);

    expect(response.status).toBe(200);
    expect(data.answer).toContain("current scene");
    expect(data.answerSource).toBe("llm");
    expect(paragraphs).toHaveLength(2);
    expect(data.sceneRange).toEqual({ startParagraph: 0, endParagraph: 12 });
    expect(Array.isArray(data.contextMeta.includedSections)).toBe(true);
  });
});
