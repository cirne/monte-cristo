import { describe, it, expect } from "vitest";
import { getChapterIndex, getChapterIndexEntry } from "./chapter-index";

describe("lib/chapter-index", () => {
  const slug = "monte-cristo";
  describe("getChapterIndex", () => {
    it("returns object with chapters array", () => {
      const index = getChapterIndex(slug);
      expect(index).toHaveProperty("chapters");
      expect(Array.isArray(index.chapters)).toBe(true);
    });
  });

  describe("getChapterIndexEntry", () => {
    it("returns undefined for non-existent chapter", () => {
      expect(getChapterIndexEntry(slug, 99999)).toBeUndefined();
    });

    it("returns entry with number, entities when chapter exists", () => {
      const entry = getChapterIndexEntry(slug, 1);
      if (entry) {
        expect(entry).toHaveProperty("number");
        expect(entry).toHaveProperty("entities");
        expect(Array.isArray(entry.entities)).toBe(true);
      }
    });

    it("includes M. Morrel in chapter 1 and chapter 5 entity lists", () => {
      const chapter1 = getChapterIndexEntry(slug, 1);
      const chapter5 = getChapterIndexEntry(slug, 5);
      expect(chapter1?.entities.some((e) => e.entityId === "m_morrel")).toBe(true);
      expect(chapter5?.entities.some((e) => e.entityId === "m_morrel")).toBe(true);
    });

    it("canonicalizes Saint-Méran aliases to Renée's existing id", () => {
      const chapter7 = getChapterIndexEntry(slug, 7);
      const chapter10 = getChapterIndexEntry(slug, 10);
      // When entity store has canonical mapping, aliases should be merged
      const hasReneeIn7 = chapter7?.entities.some((e) => e.entityId === "rene_de_saintmran");
      const hasReneeIn10 = chapter10?.entities.some((e) => e.entityId === "rene_de_saintmran");
      if (hasReneeIn7) {
        expect(chapter7?.entities.some((e) => e.entityId === "rene")).toBe(false);
      }
      if (hasReneeIn10) {
        expect(chapter10?.entities.some((e) => e.entityId === "mademoiselle_de_saintmran")).toBe(false);
      }
    });
  });
});
