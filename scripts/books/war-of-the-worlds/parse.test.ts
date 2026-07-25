import { describe, expect, it } from "vitest";
import { parseBook, parseBookWithParagraphRemaps } from "./parse";

const SAMPLE_RAW = `Project Gutenberg preface text
*** START OF THE PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS ***

Contents


 BOOK ONE.—THE COMING OF THE MARTIANS

 I. THE EVE OF THE WAR.
 II. THE FALLING STAR.

 BOOK TWO.—THE EARTH UNDER THE MARTIANS

 I. UNDER FOOT.




BOOK ONE
THE COMING OF THE MARTIANS




I.
THE EVE OF THE WAR.


No one would have believed in the last years of the nineteenth century
that this world was being watched.


II.
THE FALLING STAR.


Then came the night of the first falling star.


BOOK TWO
THE EARTH UNDER THE MARTIANS




I.
UNDER FOOT.


In the first book I have wandered so much from my own adventures.

0023m

We stopped there all Sunday night.
*** END OF THE PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS ***
Project Gutenberg trailer text`;

describe("scripts/books/war-of-the-worlds/parse", () => {
  it("parses chapters across books with global numbering and canonical HTML", () => {
    const book = parseBook(SAMPLE_RAW);
    expect(book.title).toBe("The War of the Worlds");
    expect(book.author).toBe("H. G. Wells");
    expect(book.chapters).toHaveLength(3);

    expect(book.chapters[0]).toMatchObject({
      number: 1,
      title: "BOOK ONE, Chapter 1: The Eve of the War",
      volume: "BOOK ONE",
      content:
        "<p>No one would have believed in the last years of the nineteenth century that this world was being watched.</p>",
    });

    expect(book.chapters[1]).toMatchObject({
      number: 2,
      title: "BOOK ONE, Chapter 2: The Falling Star",
      volume: "BOOK ONE",
      content: "<p>Then came the night of the first falling star.</p>",
    });

    expect(book.chapters[2]).toMatchObject({
      number: 3,
      title: "BOOK TWO, Chapter 1: Under Foot",
      volume: "BOOK TWO",
      content:
        "<p>In the first book I have wandered so much from my own adventures.</p><p>We stopped there all Sunday night.</p>",
    });
  });

  it("ignores table-of-contents lines that look like chapter titles", () => {
    const book = parseBook(SAMPLE_RAW);
    // TOC has "I. THE EVE OF THE WAR." as a single line; only body chapters count.
    expect(book.chapters.map((c) => c.number)).toEqual([1, 2, 3]);
  });

  it("builds paragraph remaps for stripped page-marker paragraphs", () => {
    const parsed = parseBookWithParagraphRemaps(SAMPLE_RAW);
    expect(parsed.paragraphRemaps).toHaveLength(3);
    expect(parsed.paragraphRemaps[2]).toMatchObject({
      chapterNumber: 3,
      sourceParagraphCount: 3,
      targetParagraphCount: 2,
      removedParagraphIndices: [1],
    });
    expect(parsed.paragraphRemaps[0]?.removedParagraphIndices ?? []).toEqual([]);
  });

  it("throws when Gutenberg boundary markers are missing", () => {
    expect(() => parseBookWithParagraphRemaps("No markers here")).toThrow(
      "Book markers not found in raw text."
    );
  });

  it("title-cases quoted and hyphenated chapter headings", () => {
    const raw = `*** START OF THE PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS ***
BOOK ONE
THE COMING OF THE MARTIANS

V.
THE HEAT-RAY.

XVII.
THE “THUNDER CHILD”.

Text about the ironclad.
*** END OF THE PROJECT GUTENBERG EBOOK THE WAR OF THE WORLDS ***`;

    const book = parseBook(raw);
    expect(book.chapters[0]?.title).toBe("BOOK ONE, Chapter 5: The Heat-Ray");
    expect(book.chapters[1]?.title).toBe('BOOK ONE, Chapter 17: The “Thunder Child”');
  });
});
