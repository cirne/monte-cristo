import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetChapter = vi.fn();
const mockGetChapterIndexEntry = vi.fn();
const mockGetChapterIndex = vi.fn();

vi.mock("./book", () => ({
  getChapter: (...args: unknown[]) => mockGetChapter(...args),
}));

vi.mock("./chapter-index", () => ({
  getChapterIndexEntry: (...args: unknown[]) => mockGetChapterIndexEntry(...args),
  getChapterIndex: (...args: unknown[]) => mockGetChapterIndex(...args),
}));

import {
  estimateTokens,
  getChapterSummaryWindowBefore,
  getSceneSummariesBeforeCurrent,
  getStorySoFarBeforeChapter,
  getSceneTextUpToParagraph,
  resolveReadingPosition,
  trimToTokenBudget,
} from "./reading-context";

describe("lib/reading-context", () => {
  beforeEach(() => {
    mockGetChapter.mockReset();
    mockGetChapterIndexEntry.mockReset();
    mockGetChapterIndex.mockReset();
  });

  it("estimates and trims token budgets using a char approximation", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(trimToTokenBudget("abcdefgh", 2)).toBe("abcdefgh");
    expect(trimToTokenBudget("abcdefghi", 2)).toBe("abcdefg…");
  });

  it("resolves reading position with normalized, contiguous scenes", () => {
    mockGetChapter.mockReturnValue({
      number: 3,
      content: "P0\n\nP1\n\nP2\n\nP3\n\nP4",
    });
    mockGetChapterIndexEntry.mockReturnValue({
      number: 3,
      entities: [],
      scenes: [
        { startParagraph: 2, endParagraph: 3, summary: "Middle movement." },
        { startParagraph: 0, endParagraph: 1, summary: "Opening." },
      ],
    });

    const pos = resolveReadingPosition(3, 100);
    expect(pos.paragraphIndex).toBe(4);
    expect(pos.sceneIndex).toBe(1);
    expect(pos.scenes).toEqual([
      { startParagraph: 0, endParagraph: 1, summary: "Opening." },
      { startParagraph: 2, endParagraph: 4, summary: "Middle movement." },
    ]);

    const currentSlice = getSceneTextUpToParagraph(pos);
    expect(currentSlice).toBe("P2\n\nP3\n\nP4");
  });

  it("returns scene summaries before current scene", () => {
    mockGetChapter.mockReturnValue({
      number: 4,
      content: "A\n\nB\n\nC\n\nD",
    });
    mockGetChapterIndexEntry.mockReturnValue({
      number: 4,
      entities: [],
      scenes: [
        { startParagraph: 0, endParagraph: 1, summary: "First scene." },
        { startParagraph: 2, endParagraph: 3, summary: "Second scene." },
      ],
    });

    const pos = resolveReadingPosition(4, 2);
    expect(getSceneSummariesBeforeCurrent(pos)).toEqual(["Scene 1: First scene."]);
  });

  it("prefers rolling story summary and falls back to chapter summary window", () => {
    mockGetChapterIndexEntry.mockImplementation((_slug: unknown, n: number) => {
      if (n === 4) return { number: 4, entities: [], storySoFarSummary: "Rolling summary through chapter 4." };
      return undefined;
    });
    expect(getStorySoFarBeforeChapter(5)).toBe("Rolling summary through chapter 4.");

    mockGetChapterIndexEntry.mockReturnValue(undefined);
    mockGetChapterIndex.mockReturnValue({
      chapters: [
        { number: 1, entities: [], chapterSummary: "Chapter 1 summary." },
        { number: 2, entities: [], chapterSummary: "Chapter 2 summary." },
        { number: 3, entities: [], chapterSummary: "Chapter 3 summary." },
      ],
    });
    expect(getChapterSummaryWindowBefore(4, 3)).toEqual([
      "Chapter 1: Chapter 1 summary.",
      "Chapter 2: Chapter 2 summary.",
      "Chapter 3: Chapter 3 summary.",
    ]);
    expect(getStorySoFarBeforeChapter(4, 3)).toBe(
      "Chapter 1: Chapter 1 summary.\nChapter 2: Chapter 2 summary.\nChapter 3: Chapter 3 summary."
    );
  });
});
