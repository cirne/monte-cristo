import { describe, it, expect } from "vitest";
import { getChapterIndex, getChapterIndexEntry } from "./chapter-index";

describe("lib/chapter-index", () => {
  describe("getChapterIndex", () => {
    it("returns object with chapters array", () => {
      const index = getChapterIndex();
      expect(index).toHaveProperty("chapters");
      expect(Array.isArray(index.chapters)).toBe(true);
    });
  });

  describe("getChapterIndexEntry", () => {
    it("returns undefined for non-existent chapter", () => {
      expect(getChapterIndexEntry(99999)).toBeUndefined();
    });

    it("returns entry with number, entities when chapter exists", () => {
      const entry = getChapterIndexEntry(1);
      if (entry) {
        expect(entry).toHaveProperty("number");
        expect(entry).toHaveProperty("entities");
        expect(Array.isArray(entry.entities)).toBe(true);
      }
    });
  });
});
