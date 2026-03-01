import { describe, it, expect } from "vitest";
import { getParagraphs, getSingleScene } from "./scenes";

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
});
