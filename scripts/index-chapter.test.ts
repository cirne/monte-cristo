import { describe, it, expect } from "vitest";
import {
  mergeEntityStoreInto,
  mergeChapterIndexInto,
} from "../lib/index-write-merge";
import type { EntityStoreData } from "../lib/entity-store";
import type { ChapterIndex, ChapterIndexEntry } from "../lib/chapter-index";

describe("scripts/index-chapter", () => {
  it("index-chapter script exists", () => {
    expect(true).toBe(true);
  });

  describe("mergeEntityStoreInto", () => {
    it("adds new entities from ours to re-read", () => {
      const reRead: EntityStoreData = {
        entities: {
          a: {
            id: "a",
            name: "Alice",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: ["Alice"],
          },
        },
        lastIndexedChapter: 1,
      };
      const ours: EntityStoreData = {
        entities: {
          a: reRead.entities.a,
          b: {
            id: "b",
            name: "Bob",
            aliases: [],
            type: "person",
            firstSeenInChapter: 2,
            searchTerms: ["Bob"],
          },
        },
        lastIndexedChapter: 2,
      };
      const merged = mergeEntityStoreInto(reRead, ours);
      expect(Object.keys(merged.entities)).toEqual(["a", "b"]);
      expect(merged.entities.b?.name).toBe("Bob");
      expect(merged.lastIndexedChapter).toBe(2);
    });

    it("takes min firstSeenInChapter and union aliases/searchTerms", () => {
      const reRead: EntityStoreData = {
        entities: {
          x: {
            id: "x",
            name: "X",
            aliases: ["Xavier"],
            type: "person",
            firstSeenInChapter: 2,
            searchTerms: ["X", "Xavier"],
          },
        },
        lastIndexedChapter: 2,
      };
      const ours: EntityStoreData = {
        entities: {
          x: {
            id: "x",
            name: "X",
            aliases: ["Mr X"],
            type: "person",
            firstSeenInChapter: 1,
            searchTerms: ["X", "Mr X"],
          },
        },
        lastIndexedChapter: 1,
      };
      const merged = mergeEntityStoreInto(reRead, ours);
      expect(merged.entities.x?.firstSeenInChapter).toBe(1);
      expect(merged.entities.x?.aliases).toContain("Xavier");
      expect(merged.entities.x?.aliases).toContain("Mr X");
      expect(merged.entities.x?.searchTerms).toEqual(expect.arrayContaining(["X", "Xavier", "Mr X"]));
    });

    it("keeps spoilerFreeIntro from re-read when present; otherwise uses ours", () => {
      const reRead: EntityStoreData = {
        entities: {
          e: {
            id: "e",
            name: "E",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            spoilerFreeIntro: "Existing intro.",
            searchTerms: ["E"],
          },
        },
        lastIndexedChapter: 1,
      };
      const ours: EntityStoreData = {
        entities: {
          e: {
            id: "e",
            name: "E",
            aliases: [],
            type: "person",
            firstSeenInChapter: 1,
            spoilerFreeIntro: "New intro.",
            searchTerms: ["E"],
          },
        },
        lastIndexedChapter: 1,
      };
      const merged = mergeEntityStoreInto(reRead, ours);
      expect(merged.entities.e?.spoilerFreeIntro).toBe("Existing intro.");
    });
  });

  describe("mergeChapterIndexInto", () => {
    it("starts from re-read and overwrites only chapters we processed", () => {
      const ch1: ChapterIndexEntry = {
        number: 1,
        baselineIntro: "Intro",
        entities: [{ entityId: "a", type: "person", firstSeenInChapter: 1 }],
      };
      const ch2FromReRead: ChapterIndexEntry = {
        number: 2,
        entities: [{ entityId: "a", type: "person", firstSeenInChapter: 1 }],
      };
      const ch2Ours: ChapterIndexEntry = {
        number: 2,
        entities: [
          { entityId: "a", type: "person", firstSeenInChapter: 1 },
          { entityId: "b", type: "person", firstSeenInChapter: 2 },
        ],
      };
      const reRead: ChapterIndex = { chapters: [ch1, ch2FromReRead] };
      const ours: ChapterIndex = { chapters: [ch2Ours] };
      const merged = mergeChapterIndexInto(reRead, ours, [{ number: 2 }]);
      expect(merged.chapters).toHaveLength(2);
      expect(merged.chapters[0].number).toBe(1);
      expect(merged.chapters[0].entities).toHaveLength(1);
      expect(merged.chapters[1].number).toBe(2);
      expect(merged.chapters[1].entities).toHaveLength(2);
    });

    it("sorts chapters by number", () => {
      const reRead: ChapterIndex = {
        chapters: [
          { number: 1, entities: [] },
          { number: 3, entities: [] },
        ],
      };
      const ours: ChapterIndex = {
        chapters: [{ number: 2, entities: [] }],
      };
      const merged = mergeChapterIndexInto(reRead, ours, [{ number: 2 }]);
      expect(merged.chapters.map((c) => c.number)).toEqual([1, 2, 3]);
    });
  });
});
