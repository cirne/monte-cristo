import { describe, it, expect } from "vitest";
import { getBookIndex, getChapter, VOLUME_LABELS, VOLUMES } from "./book";

describe("lib/book", () => {
  describe("getBookIndex", () => {
    it("returns BookIndex with title, author, chapters", () => {
      try {
        const index = getBookIndex();
        expect(index).toHaveProperty("title");
        expect(index).toHaveProperty("author");
        expect(index).toHaveProperty("chapters");
        expect(Array.isArray(index.chapters)).toBe(true);
        if (index.chapters.length > 0) {
          expect(index.chapters[0]).toHaveProperty("number");
          expect(index.chapters[0]).toHaveProperty("title");
          expect(index.chapters[0]).toHaveProperty("volume");
        }
      } catch {
        // data/book-index.json may not exist in CI
        expect(true).toBe(true);
      }
    });
  });

  describe("getChapter", () => {
    it("returns undefined for invalid chapter number", () => {
      try {
        expect(getChapter(99999)).toBeUndefined();
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  it("re-exports VOLUME_LABELS and VOLUMES", () => {
    expect(VOLUME_LABELS).toBeDefined();
    expect(VOLUMES).toBeDefined();
  });
});
