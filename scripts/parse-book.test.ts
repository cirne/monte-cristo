import { describe, it, expect } from "vitest";
import {
  parseBook,
  parseBookWithParagraphRemaps,
  remapChapterIndexScenes,
  stripStandalonePageMarkerParagraphs,
} from "./parse-book";

describe("scripts/parse-book", () => {
  describe("stripStandalonePageMarkerParagraphs", () => {
    it("removes standalone Gutenberg page marker paragraphs", () => {
      const content = "Paragraph A.\n\n0023m\n\nParagraph B.";
      expect(stripStandalonePageMarkerParagraphs(content)).toBe("Paragraph A.\n\nParagraph B.");
    });

    it("removes legacy zero-width placeholder paragraphs", () => {
      const content = "Paragraph A.\n\n\u200B\n\nParagraph B.";
      expect(stripStandalonePageMarkerParagraphs(content)).toBe("Paragraph A.\n\nParagraph B.");
    });
  });

  it("parseBook removes marker-only paragraphs from chapter content", () => {
    const raw = `Project Gutenberg header
Chapter 1. Arrival
Table of contents entry

VOLUME ONE

Chapter 1. Arrival

First paragraph.

0023m

Second paragraph.

Chapter 2. Father and Son

Another paragraph.
*** END OF THIS PROJECT GUTENBERG EBOOK`;

    const parsed = parseBook(raw);
    const chapter1 = parsed.chapters.find((chapter) => chapter.number === 1);
    expect(chapter1?.content).toContain("First paragraph.\n\nSecond paragraph.");
    expect(chapter1?.content).not.toContain("0023m");
    expect(chapter1?.content).not.toContain("\u200B");
  });

  it("parseBookWithParagraphRemaps reports removed marker paragraph indices", () => {
    const raw = `Header
Chapter 1. Arrival
toc

VOLUME ONE

Chapter 1. Arrival

First paragraph.

0023m

Second paragraph.

*** END OF THIS PROJECT GUTENBERG EBOOK`;

    const parsed = parseBookWithParagraphRemaps(raw);
    expect(parsed.paragraphRemaps).toHaveLength(1);
    expect(parsed.paragraphRemaps[0]).toMatchObject({
      chapterNumber: 1,
      sourceParagraphCount: 3,
      targetParagraphCount: 2,
      removedParagraphIndices: [1],
    });
  });

  it("remapChapterIndexScenes shifts scene paragraph indices after marker removal", () => {
    const index = {
      chapters: [
        {
          number: 1,
          scenes: [
            { startParagraph: 0, endParagraph: 0, locationDescription: "A" },
            { startParagraph: 2, endParagraph: 2, locationDescription: "B" },
          ],
        },
      ],
    };

    const paragraphRemaps = [
      {
        chapterNumber: 1,
        sourceParagraphCount: 3,
        targetParagraphCount: 2,
        removedParagraphIndices: [1],
      },
    ];

    const result = remapChapterIndexScenes(index, paragraphRemaps);
    expect(result.chaptersTouched).toBe(1);
    expect(result.scenesTouched).toBe(1);
    expect(result.updatedIndex.chapters[0].scenes).toEqual([
      { startParagraph: 0, endParagraph: 0, locationDescription: "A" },
      { startParagraph: 1, endParagraph: 1, locationDescription: "B" },
    ]);
  });

  it("remapChapterIndexScenes skips chapters that are already in target range", () => {
    const index = {
      chapters: [
        {
          number: 1,
          scenes: [
            { startParagraph: 0, endParagraph: 0 },
            { startParagraph: 1, endParagraph: 1 },
          ],
        },
      ],
    };

    const paragraphRemaps = [
      {
        chapterNumber: 1,
        sourceParagraphCount: 3,
        targetParagraphCount: 2,
        removedParagraphIndices: [1],
      },
    ];

    const result = remapChapterIndexScenes(index, paragraphRemaps);
    expect(result.chaptersTouched).toBe(0);
    expect(result.scenesTouched).toBe(0);
    expect(result.updatedIndex.chapters[0].scenes).toEqual(index.chapters[0].scenes);
  });
});
