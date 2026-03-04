import { describe, expect, it } from "vitest";
import { parseBook, parseBookWithParagraphRemaps } from "./parse";

const SAMPLE_RAW = `Project Gutenberg preface text
*** START OF THE PROJECT GUTENBERG EBOOK CRIME AND PUNISHMENT ***
PART I
CHAPTER I

First paragraph.

0023m

Second paragraph.

CHAPTER II

Third paragraph.

PART II
CHAPTER I

Fourth paragraph.
*** END OF THE PROJECT GUTENBERG EBOOK CRIME AND PUNISHMENT ***
Project Gutenberg trailer text`;

describe("scripts/books/crime-and-punishment/parse", () => {
  it("parses chapters across parts with global numbering and canonical HTML content", () => {
    const book = parseBook(SAMPLE_RAW);
    expect(book.title).toBe("Crime and Punishment");
    expect(book.chapters).toHaveLength(3);

    expect(book.chapters[0]).toMatchObject({
      number: 1,
      title: "PART I, Chapter 1",
      volume: "PART I",
      content: "<p>First paragraph.</p><p>Second paragraph.</p>",
    });

    expect(book.chapters[1]).toMatchObject({
      number: 2,
      title: "PART I, Chapter 2",
      volume: "PART I",
      content: "<p>Third paragraph.</p>",
    });

    expect(book.chapters[2]).toMatchObject({
      number: 3,
      title: "PART II, Chapter 1",
      volume: "PART II",
      content: "<p>Fourth paragraph.</p>",
    });
  });

  it("builds paragraph remaps for stripped page-marker paragraphs", () => {
    const parsed = parseBookWithParagraphRemaps(SAMPLE_RAW);
    expect(parsed.paragraphRemaps).toHaveLength(3);
    expect(parsed.paragraphRemaps[0]).toMatchObject({
      chapterNumber: 1,
      sourceParagraphCount: 3,
      targetParagraphCount: 2,
      removedParagraphIndices: [1],
    });
    expect(parsed.paragraphRemaps[1]?.removedParagraphIndices ?? []).toEqual([]);
    expect(parsed.paragraphRemaps[2]?.removedParagraphIndices ?? []).toEqual([]);
  });

  it("throws when Gutenberg boundary markers are missing", () => {
    expect(() => parseBookWithParagraphRemaps("No markers here")).toThrow(
      "Book markers not found in raw text."
    );
  });
});
