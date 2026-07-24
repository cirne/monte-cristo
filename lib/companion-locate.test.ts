import { describe, it, expect } from "vitest";
import {
  normalizeForMatch,
  matchBookByTitle,
  locateSnippet,
  type CompanionBookCandidate,
  type ChapterParagraphs,
} from "./companion-locate";

const CANDIDATES: CompanionBookCandidate[] = [
  { slug: "monte-cristo", title: "The Count of Monte Cristo", author: "Alexandre Dumas, père" },
  { slug: "gatsby", title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { slug: "crime-punishment", title: "Crime and Punishment", author: "Fyodor Dostoyevsky" },
];

describe("lib/companion-locate", () => {
  describe("normalizeForMatch", () => {
    it("lowercases, strips diacritics and punctuation, collapses whitespace", () => {
      expect(normalizeForMatch("  Edmond   Dantès—sailor!  ")).toBe("edmond dantes sailor");
    });

    it("strips HTML tags and entities", () => {
      expect(normalizeForMatch("<p>He said&mdash;<em>“wait”</em></p>")).toBe("he said wait");
    });
  });

  describe("matchBookByTitle", () => {
    it("matches an exact title", () => {
      expect(matchBookByTitle("The Count of Monte Cristo", CANDIDATES)?.slug).toBe("monte-cristo");
    });

    it("matches a Kindle-style decorated title", () => {
      expect(
        matchBookByTitle("The Count of Monte Cristo (AmazonClassics Edition)", CANDIDATES)?.slug
      ).toBe("monte-cristo");
    });

    it("matches without a leading article", () => {
      expect(matchBookByTitle("Count of Monte Cristo", CANDIDATES)?.slug).toBe("monte-cristo");
    });

    it("matches a partial input contained in the registered title", () => {
      expect(matchBookByTitle("Great Gatsby", CANDIDATES)?.slug).toBe("gatsby");
    });

    it("returns null for an unknown book", () => {
      expect(matchBookByTitle("Moby-Dick; or, The Whale", CANDIDATES)).toBeNull();
    });

    it("returns null for very short inputs", () => {
      expect(matchBookByTitle("The", CANDIDATES)).toBeNull();
      expect(matchBookByTitle("", CANDIDATES)).toBeNull();
    });
  });

  describe("locateSnippet", () => {
    const chapters: ChapterParagraphs[] = [
      {
        number: 1,
        paragraphs: [
          "On the 24th of February, 1815, the look-out at Notre-Dame de la Garde signalled the three-master, the Pharaon from Smyrna, Trieste, and Naples.",
          "As usual, a pilot put off immediately, and rounding the Château d’If, got on board the vessel between Cape Morgiou and Rion island.",
        ],
      },
      {
        number: 2,
        paragraphs: [
          "We will leave Danglars struggling with the demon of hatred, and endeavoring to insinuate in the ear of the shipowner some evil suspicions against his comrade.",
          "Dantès, after having traversed La Canebière, took the Rue de Noailles, and entering a small house.",
        ],
      },
    ];

    it("locates a snippet in the correct chapter and paragraph", () => {
      expect(
        locateSnippet(chapters, "As usual, a pilot put off immediately, and rounding the Château")
      ).toEqual({ chapter: 1, paragraph: 1 });
    });

    it("locates a snippet in a later chapter", () => {
      expect(
        locateSnippet(chapters, "Dantès, after having traversed La Canebière, took the Rue")
      ).toEqual({ chapter: 2, paragraph: 1 });
    });

    it("tolerates curly quotes, dashes, and case differences", () => {
      expect(
        locateSnippet(chapters, "ROUNDING THE CHATEAU D'IF, got on board the vessel between cape")
      ).toEqual({ chapter: 1, paragraph: 1 });
    });

    it("matches a snippet that spans a paragraph boundary, returning the starting paragraph", () => {
      const snippet =
        "signalled the three-master, the Pharaon from Smyrna, Trieste, and Naples. As usual, a pilot put off immediately";
      expect(locateSnippet(chapters, snippet)).toEqual({ chapter: 1, paragraph: 0 });
    });

    it("falls back to a shorter needle when the tail has noise", () => {
      const snippet =
        "We will leave Danglars struggling with the demon of hatred, and endeavoring COMPLETELY DIFFERENT NOISE WORDS THAT DO NOT EXIST ANYWHERE IN THE TEXT AT ALL PADDING PADDING PADDING PADDING PADDING PADDING PADDING PADDING PADDING PADDING PADDING PADDING";
      expect(locateSnippet(chapters, snippet)).toEqual({ chapter: 2, paragraph: 0 });
    });

    it("returns null when the snippet is not in the book", () => {
      expect(
        locateSnippet(chapters, "Call me Ishmael. Some years ago, never mind how long precisely")
      ).toBeNull();
    });

    it("returns null for snippets that are too short", () => {
      expect(locateSnippet(chapters, "a pilot")).toBeNull();
      expect(locateSnippet(chapters, "")).toBeNull();
    });
  });
});
