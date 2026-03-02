import { describe, expect, it } from "vitest";
import { parseBook, parseBookWithParagraphRemaps } from "./parse";

const SAMPLE_RAW = `Some header
*** START OF THE PROJECT GUTENBERG EBOOK THE BROTHERS KARAMAZOV ***

Contents

 Part I
 Book I. The History Of A Family
 Chapter I. Fyodor Pavlovitch Karamazov

PART I

Book I. The History Of A Family

Chapter I.
Fyodor Pavlovitch Karamazov

First paragraph.

0023m

Second paragraph.

Chapter II.
He Gets Rid Of His Eldest Son

Third paragraph.

PART II

Book IV. Lacerations

Chapter I.
Father Ferapont

Fourth paragraph.

Epilogue

Chapter I.
Plans For Mitya’s Escape

Fifth paragraph.

Footnotes

Not part of narrative.
*** END OF THE PROJECT GUTENBERG EBOOK THE BROTHERS KARAMAZOV ***
Trailer`;

describe("scripts/books/brothers-karamazov/parse", () => {
  it("parses chapters with global numbering and canonical HTML content", () => {
    const book = parseBook(SAMPLE_RAW);
    expect(book.title).toBe("The Brothers Karamazov");
    expect(book.chapters).toHaveLength(4);

    expect(book.chapters[0]).toMatchObject({
      number: 1,
      volume: "PART I",
      title: "BOOK I. The History Of A Family, Chapter 1. Fyodor Pavlovitch Karamazov",
      content: "<p>First paragraph.</p><p>Second paragraph.</p>",
    });
    expect(book.chapters[1]).toMatchObject({
      number: 2,
      volume: "PART I",
      title: "BOOK I. The History Of A Family, Chapter 2. He Gets Rid Of His Eldest Son",
      content: "<p>Third paragraph.</p>",
    });
    expect(book.chapters[2]).toMatchObject({
      number: 3,
      volume: "PART II",
      title: "BOOK IV. Lacerations, Chapter 1. Father Ferapont",
      content: "<p>Fourth paragraph.</p>",
    });
    expect(book.chapters[3]).toMatchObject({
      number: 4,
      volume: "EPILOGUE",
      title: "Epilogue, Chapter 1. Plans For Mitya’s Escape",
      content: "<p>Fifth paragraph.</p>",
    });
  });

  it("builds paragraph remaps for stripped page-marker paragraphs", () => {
    const parsed = parseBookWithParagraphRemaps(SAMPLE_RAW);
    expect(parsed.paragraphRemaps).toHaveLength(4);
    expect(parsed.paragraphRemaps[0]).toMatchObject({
      chapterNumber: 1,
      sourceParagraphCount: 3,
      targetParagraphCount: 2,
      removedParagraphIndices: [1],
    });
  });

  it("throws when Gutenberg boundary markers are missing", () => {
    expect(() => parseBookWithParagraphRemaps("No markers here")).toThrow(
      "Book markers not found in raw text."
    );
  });
});

