import { describe, it, expect } from "vitest";
import {
  getBook,
  getBookIndex,
  getChapter,
  getTableOfContents,
  getSection,
} from "./book";

describe("lib/book", () => {
  describe("getBookIndex", () => {
    it("returns BookIndex with title, author, chapters for known slug with data", () => {
      const index = getBookIndex("monte-cristo");
      if (!index) return; // no data in CI
      expect(index).toHaveProperty("title");
      expect(index).toHaveProperty("author");
      expect(index).toHaveProperty("chapters");
      expect(Array.isArray(index.chapters)).toBe(true);
      if (index.chapters.length > 0) {
        expect(index.chapters[0]).toHaveProperty("number");
        expect(index.chapters[0]).toHaveProperty("title");
        expect(index.chapters[0]).toHaveProperty("volume");
      }
    });
    it("returns undefined for slug with no data", () => {
      expect(getBookIndex("no-such-book-slug")).toBeUndefined();
    });
  });

  describe("getChapter", () => {
    it("loads chapter content from canonical chapter files when data exists", () => {
      const index = getBookIndex("monte-cristo");
      if (!index || index.chapters.length === 0) return; // no data in CI
      const first = index.chapters[0]!;
      const chapter = getChapter("monte-cristo", first.number);
      expect(chapter).toBeDefined();
      expect(chapter?.number).toBe(first.number);
      expect(chapter?.title).toBe(first.title);
      expect(chapter?.volume).toBe(first.volume);
      expect(typeof chapter?.content).toBe("string");
      expect((chapter?.content.length ?? 0) > 0).toBe(true);
    });

    it("returns undefined for invalid chapter number", () => {
      const ch = getChapter("monte-cristo", 99999);
      expect(ch).toBeUndefined();
    });
  });

  describe("getBook", () => {
    it("loads chapter content for each indexed chapter when data exists", () => {
      const index = getBookIndex("monte-cristo");
      if (!index) return; // no data in CI
      const book = getBook("monte-cristo");
      if (!book) return; // no data in CI
      expect(book.chapters.length).toBe(index.chapters.length);
      if (book.chapters.length > 0) {
        expect(typeof book.chapters[0].content).toBe("string");
        expect(book.chapters[0].content.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getTableOfContents", () => {
    it("returns TOC with chapters when no front/back matter", () => {
      const toc = getTableOfContents("monte-cristo");
      expect(Array.isArray(toc)).toBe(true);
      if (toc.length === 0) return; // no data in CI
      const chapters = toc.filter((e) => e.type === "chapter");
      expect(chapters.length).toBeGreaterThan(0);
      expect(chapters.every((e) => e.type === "chapter" && "number" in e)).toBe(true);
    });
  });

  describe("getSection", () => {
    it("returns undefined for unknown section id", () => {
      const section = getSection("monte-cristo", "__nonexistent__");
      expect(section).toBeUndefined();
    });
  });
});
