import { describe, it, expect } from "vitest";
import {
  parseBook,
  parseBookWithParagraphRemaps,
} from "./parse";

describe("scripts/books/gatsby/parse", () => {
  describe("stripFirstParagraph", () => {
    it("parseBook removes first paragraph from chapter content", () => {
      const html = `<div id="chapter-4">
<p>IV</p>
<p>On Sunday morning while church bells rang in the villages alongshore, the world and its mistress returned to Gatsby's house.</p>
<p>Another paragraph here.</p>
</div>`;

      const parsed = parseBook(html);
      const chapter4 = parsed.chapters.find((chapter) => chapter.number === 4);
      expect(chapter4?.content).toContain("<p>On Sunday morning");
      expect(chapter4?.content).not.toContain("<p>IV</p>");
      expect(chapter4?.content).toContain("<p>Another paragraph");
    });

    it("parseBookWithParagraphRemaps reports removed first paragraph index", () => {
      const html = `<div id="chapter-1">
<p>I</p>
<p>In my younger and more vulnerable years my father gave me some advice.</p>
</div>
<div id="chapter-4">
<p>IV</p>
<p>On Sunday morning while church bells rang.</p>
</div>`;

      const parsed = parseBookWithParagraphRemaps(html);
      expect(parsed.paragraphRemaps).toHaveLength(2);
      
      expect(parsed.paragraphRemaps[0]).toMatchObject({
        chapterNumber: 1,
        sourceParagraphCount: 2,
        targetParagraphCount: 1,
        removedParagraphIndices: [0],
      });

      expect(parsed.paragraphRemaps[1]).toMatchObject({
        chapterNumber: 4,
        sourceParagraphCount: 2,
        targetParagraphCount: 1,
        removedParagraphIndices: [0],
      });
    });

    it("handles single-paragraph chapter without crashing", () => {
      const html = `<div id="chapter-1">
<p>I</p>
</div>`;

      const parsed = parseBook(html);
      const chapter1 = parsed.chapters.find((chapter) => chapter.number === 1);
      expect(chapter1?.content).toBe("");
    });
  });
});
