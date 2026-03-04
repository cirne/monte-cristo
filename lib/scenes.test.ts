import { describe, it, expect } from "vitest";
import { getParagraphs, getSingleScene, normalizeScenes } from "./scenes";

describe("lib/scenes", () => {
  describe("getParagraphs", () => {
    it("splits on double newlines", () => {
      const content = "First para.\n\nSecond para.\n\nThird para.";
      expect(getParagraphs(content)).toEqual([
        "First para.",
        "Second para.",
        "Third para.",
      ]);
    });

    it("preserves single newlines within paragraphs", () => {
      const content = "Line one\nLine two\n\nNext para.";
      expect(getParagraphs(content)).toEqual([
        "Line one Line two",
        "Next para.",
      ]);
    });

    it("filters empty paragraphs", () => {
      const content = "A\n\n\n\nB";
      expect(getParagraphs(content)).toEqual(["A", "B"]);
    });

    it("returns empty array for empty string", () => {
      expect(getParagraphs("")).toEqual([]);
    });

    it("parses canonical HTML and returns plain-text paragraphs", () => {
      const html = "<p>First paragraph.</p><p>Second with <em>emphasis</em>.</p>";
      expect(getParagraphs(html)).toEqual([
        "First paragraph.",
        "Second with emphasis.",
      ]);
    });
  });

  describe("getSingleScene", () => {
    it("returns one scene covering all paragraphs", () => {
      const content = "P1\n\nP2\n\nP3";
      const paras = getParagraphs(content);
      const scene = getSingleScene(content);
      expect(scene).toHaveLength(1);
      expect(scene[0]).toEqual({ startParagraph: 0, endParagraph: paras.length - 1 });
    });

    it("returns empty array for empty content", () => {
      expect(getSingleScene("")).toEqual([]);
    });
  });

  describe("normalizeScenes", () => {
    it("returns one full-range scene when scenes are missing", () => {
      expect(normalizeScenes(undefined, 4)).toEqual([{ startParagraph: 0, endParagraph: 3 }]);
    });

    it("normalizes unordered and overlapping starts into contiguous ranges", () => {
      const normalized = normalizeScenes(
        [
          { startParagraph: 10, endParagraph: 20, locationDescription: "Late" },
          { startParagraph: 0, endParagraph: 5, locationDescription: "Early" },
          { startParagraph: 5, endParagraph: 9, locationDescription: "Middle" },
        ],
        12
      );
      expect(normalized).toEqual([
        { startParagraph: 0, endParagraph: 4, locationDescription: "Early" },
        { startParagraph: 5, endParagraph: 9, locationDescription: "Middle" },
        { startParagraph: 10, endParagraph: 11, locationDescription: "Late" },
      ]);
    });

    it("merges duplicate startParagraph scene metadata without clobbering existing fields", () => {
      const normalized = normalizeScenes(
        [
          { startParagraph: 3, endParagraph: 4, locationDescription: "Dining room" },
          { startParagraph: 3, endParagraph: 6, summary: "A tense discussion", characterIds: ["dantes"] },
        ],
        8
      );
      expect(normalized).toEqual([
        { startParagraph: 0, endParagraph: 2 },
        {
          startParagraph: 3,
          endParagraph: 7,
          locationDescription: "Dining room",
          summary: "A tense discussion",
          characterIds: ["dantes"],
        },
      ]);
    });
  });
});
