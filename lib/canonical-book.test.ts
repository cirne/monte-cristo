import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  splitParagraphs,
  stripPageMarkerLines,
  buildParagraphIndexRemap,
  remapChapterIndexScenes,
  writeCanonicalBook,
  type Book,
  type ParagraphIndexRemap,
} from "./canonical-book";

describe("lib/canonical-book", () => {
  describe("splitParagraphs", () => {
    it("splits on double newline and trims", () => {
      const content = "One\n\nTwo\n\nThree";
      expect(splitParagraphs(content)).toEqual(["One", "Two", "Three"]);
    });

    it("replaces single newlines with space within paragraph", () => {
      const content = "Line one\nLine two\n\nNext para";
      expect(splitParagraphs(content)).toEqual(["Line one Line two", "Next para"]);
    });

    it("filters empty paragraphs", () => {
      const content = "A\n\n\n\nB";
      expect(splitParagraphs(content)).toEqual(["A", "B"]);
    });
  });

  describe("stripPageMarkerLines", () => {
    it("removes Gutenberg page marker lines", () => {
      const content = "Hello\n\n0267m\n\nWorld";
      expect(stripPageMarkerLines(content)).toBe("Hello\n\nWorld");
    });

    it("collapses multiple blank lines", () => {
      const content = "A\n\n\n\n\nB";
      expect(stripPageMarkerLines(content)).toBe("A\n\nB");
    });

    it("leaves normal content unchanged", () => {
      const content = "Chapter 1.\n\nThe ship arrived.";
      expect(stripPageMarkerLines(content)).toBe(content);
    });
  });

  describe("buildParagraphIndexRemap", () => {
    it("records removed paragraph indices when target has fewer paragraphs", () => {
      const source = "A\n\n0267m\n\nB";
      const target = stripPageMarkerLines(source);
      const remap = buildParagraphIndexRemap(1, source, target);
      expect(remap.chapterNumber).toBe(1);
      expect(remap.sourceParagraphCount).toBe(3);
      expect(remap.targetParagraphCount).toBe(2);
      expect(remap.removedParagraphIndices).toContain(1);
    });
  });

  describe("remapChapterIndexScenes", () => {
    it("returns index unchanged when no remaps affect scenes", () => {
      const index = {
        chapters: [{ number: 1, scenes: [{ startParagraph: 0, endParagraph: 2 }] }],
      };
      const remaps: ParagraphIndexRemap[] = [];
      const { updatedIndex, chaptersTouched, scenesTouched } = remapChapterIndexScenes(
        index,
        remaps
      );
      expect(updatedIndex).toEqual(index);
      expect(chaptersTouched).toBe(0);
      expect(scenesTouched).toBe(0);
    });

    it("maps scene ranges when paragraph indices were removed", () => {
      const index = {
        chapters: [
          {
            number: 1,
            scenes: [
              { startParagraph: 0, endParagraph: 0 },
              { startParagraph: 2, endParagraph: 3 },
            ],
          },
        ],
      };
      const remaps: ParagraphIndexRemap[] = [
        {
          chapterNumber: 1,
          sourceParagraphCount: 4,
          targetParagraphCount: 3,
          removedParagraphIndices: [1],
        },
      ];
      const { updatedIndex, scenesTouched } = remapChapterIndexScenes(index, remaps);
      expect(updatedIndex.chapters[0].scenes).toBeDefined();
      expect(updatedIndex.chapters[0].scenes![0].startParagraph).toBe(0);
      expect(updatedIndex.chapters[0].scenes![0].endParagraph).toBe(0);
      expect(updatedIndex.chapters[0].scenes![1].startParagraph).toBe(1);
      expect(updatedIndex.chapters[0].scenes![1].endParagraph).toBe(2);
      expect(scenesTouched).toBe(1);
    });
  });

  describe("writeCanonicalBook", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "canonical-book-test-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("writes chapter HTML files and book-index.json to data/<slug>/", () => {
      const book: Book = {
        title: "Test Book",
        author: "Author",
        source: "test",
        license: "PD",
        chapters: [
          { number: 1, title: "Ch1", volume: "V1", content: "<p>Content one.</p>" },
          { number: 2, title: "Ch2", volume: "V1", content: "<p>Content two.</p>" },
        ],
      };

      const bookDir = join(tmpDir, "test-slug");
      rmSync(bookDir, { recursive: true, force: true });
      // Verify legacy files are cleaned up during migration.
      mkdirSync(bookDir, { recursive: true });
      writeFileSync(join(bookDir, "book.json"), '{"legacy":true}', "utf-8");

      writeCanonicalBook(tmpDir, "test-slug", book);

      expect(existsSync(join(bookDir, "book-index.json"))).toBe(true);
      expect(existsSync(join(bookDir, "book.json"))).toBe(false);
      expect(existsSync(join(bookDir, "chapters", "1.html"))).toBe(true);
      expect(existsSync(join(bookDir, "chapters", "2.html"))).toBe(true);

      expect(readFileSync(join(bookDir, "chapters", "1.html"), "utf-8")).toBe(
        "<p>\nContent one.\n</p>"
      );
      expect(readFileSync(join(bookDir, "chapters", "2.html"), "utf-8")).toBe(
        "<p>\nContent two.\n</p>"
      );

      const indexJson = JSON.parse(readFileSync(join(bookDir, "book-index.json"), "utf-8"));
      expect(indexJson.title).toBe("Test Book");
      expect(indexJson.chapters).toHaveLength(2);
      expect(indexJson.chapters[0]).not.toHaveProperty("content");
    });
  });
});
