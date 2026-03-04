import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreateChatCompletion = vi.fn();
const mockResolveReadingPosition = vi.fn();
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
  getStorySoFarBeforeChapter: (...args: unknown[]) => mockGetStorySoFarBeforeChapter(...args),
  getSceneSummariesBeforeCurrent: (...args: unknown[]) => mockGetSceneSummariesBeforeCurrent(...args),
  getSceneTextUpToParagraph: (...args: unknown[]) => mockGetSceneTextUpToParagraph(...args),
}));

import { GET } from "./route";

describe("app/api/context/story-so-far/route", () => {
  beforeEach(() => {
    mockCreateChatCompletion.mockReset();
    mockResolveReadingPosition.mockReset();
    mockGetStorySoFarBeforeChapter.mockReset();
    mockGetSceneSummariesBeforeCurrent.mockReset();
    mockGetSceneTextUpToParagraph.mockReset();
  });

  it("returns 400 for invalid params", async () => {
    const request = new NextRequest("http://localhost/api/context/story-so-far?chapter=-2&paragraph=4");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("returns story-so-far response for a checkpoint", async () => {
    mockResolveReadingPosition.mockReturnValue({
      chapterNumber: 8,
      paragraphIndex: 22,
      paragraphs: ["p0", "p1"],
      scenes: [{ startParagraph: 20, endParagraph: 30 }],
      sceneIndex: 1,
      scene: { startParagraph: 20, endParagraph: 30 },
    });
    mockGetStorySoFarBeforeChapter.mockReturnValue("Rolling summary through chapter seven.");
    mockGetSceneSummariesBeforeCurrent.mockReturnValue(["Scene 1: A conflict escalates."]);
    mockGetSceneTextUpToParagraph.mockReturnValue("Current chapter excerpt through this checkpoint.");
    mockCreateChatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              answer:
                "So far, alliances tighten while hidden motives sharpen.\n\nA second thread develops around social pressure.\n\nA third thread emphasizes consequences already in motion.\n\nA fourth paragraph should be merged to stay within limits.",
            }),
          },
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/context/story-so-far?chapter=8&paragraph=22");
    const response = await GET(request);
    const data = await response.json();
    const paragraphs = String(data.answer).split(/\n\s*\n+/);

    expect(response.status).toBe(200);
    expect(data.answer).toContain("So far");
    expect(data.answerSource).toBe("llm");
    expect(paragraphs.length).toBeLessThanOrEqual(3);
    expect(paragraphs).toHaveLength(3);
    expect(data.sceneIndex).toBe(1);
    expect(Array.isArray(data.contextMeta.includedSections)).toBe(true);
  });
});
