import { describe, expect, it } from "vitest";
import type { ChapterIndexEntry } from "./chapter-index";
import { mergeChapterEntities, mergeChapterIndexEntry, mergeChapterScenes } from "./chapter-index-merge";

describe("lib/chapter-index-merge", () => {
  it("keeps existing entities when incoming entities are empty", () => {
    const existing: ChapterIndexEntry = {
      number: 6,
      entities: [{ entityId: "villefort", type: "person", firstSeenInChapter: 6, excerpt: "Old excerpt" }],
    };
    const incoming: ChapterIndexEntry = { number: 6, entities: [] };

    const merged = mergeChapterIndexEntry(existing, incoming);
    expect(merged.entities).toEqual(existing.entities);
  });

  it("merges known entity without regressing firstSeenInChapter", () => {
    const merged = mergeChapterEntities(
      [{ entityId: "dantes", type: "person", firstSeenInChapter: 1, excerpt: "Old" }],
      [{ entityId: "dantes", type: "person", firstSeenInChapter: 5, excerpt: "New" }]
    );

    expect(merged).toEqual([
      { entityId: "dantes", type: "person", firstSeenInChapter: 1, excerpt: "New" },
    ]);
  });

  it("backfills missing scene metadata without overwriting boundaries", () => {
    const merged = mergeChapterScenes(
      [{ startParagraph: 0, endParagraph: 95 }],
      [{ startParagraph: 0, endParagraph: 67, locationDescription: "Dining hall", summary: "Guests gather." }]
    );

    expect(merged).toEqual([
      {
        startParagraph: 0,
        endParagraph: 95,
        locationDescription: "Dining hall",
        summary: "Guests gather.",
      },
    ]);
  });

  it("appends additional incoming scenes additively", () => {
    const merged = mergeChapterScenes(
      [{ startParagraph: 0, endParagraph: 10, locationDescription: "Existing location" }],
      [
        { startParagraph: 0, endParagraph: 10, locationDescription: "Incoming location" },
        { startParagraph: 11, endParagraph: 20, locationDescription: "New location" },
      ]
    );

    expect(merged?.length).toBe(2);
    expect(merged?.[0].locationDescription).toBe("Existing location");
    expect(merged?.[1].locationDescription).toBe("New location");
  });

  it("replaces chapter entry only when overwriteExisting is true", () => {
    const existing: ChapterIndexEntry = {
      number: 6,
      entities: [{ entityId: "villefort", type: "person", firstSeenInChapter: 6 }],
      scenes: [{ startParagraph: 0, endParagraph: 95 }],
    };
    const incoming: ChapterIndexEntry = {
      number: 6,
      entities: [{ entityId: "dantes", type: "person", firstSeenInChapter: 1 }],
      scenes: [{ startParagraph: 0, endParagraph: 67, locationDescription: "Dining hall" }],
    };

    const merged = mergeChapterIndexEntry(existing, incoming, { overwriteExisting: true });
    expect(merged).toEqual(incoming);
  });

  it("preserves existing chapter summary metadata in patch mode", () => {
    const existing: ChapterIndexEntry = {
      number: 10,
      chapterSummary: "Existing chapter summary",
      storySoFarSummary: "Existing rolling summary",
      entities: [{ entityId: "dantes", type: "person", firstSeenInChapter: 1 }],
    };
    const incoming: ChapterIndexEntry = {
      number: 10,
      chapterSummary: "New chapter summary",
      storySoFarSummary: "New rolling summary",
      entities: [{ entityId: "dantes", type: "person", firstSeenInChapter: 1 }],
    };

    const merged = mergeChapterIndexEntry(existing, incoming);
    expect(merged.chapterSummary).toBe("Existing chapter summary");
    expect(merged.storySoFarSummary).toBe("Existing rolling summary");
  });

  it("backfills missing chapter summary metadata from incoming entry", () => {
    const existing: ChapterIndexEntry = {
      number: 11,
      entities: [{ entityId: "dantes", type: "person", firstSeenInChapter: 1 }],
    };
    const incoming: ChapterIndexEntry = {
      number: 11,
      chapterSummary: "Chapter eleven in one paragraph.",
      storySoFarSummary: "Story so far through chapter eleven.",
      entities: [{ entityId: "dantes", type: "person", firstSeenInChapter: 1 }],
    };

    const merged = mergeChapterIndexEntry(existing, incoming);
    expect(merged.chapterSummary).toBe("Chapter eleven in one paragraph.");
    expect(merged.storySoFarSummary).toBe("Story so far through chapter eleven.");
  });
});
