import { describe, it, expect } from "vitest";
import { parseBook, stripStandalonePageMarkerParagraphs } from "./parse-book";

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
});
