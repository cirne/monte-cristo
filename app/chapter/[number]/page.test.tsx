import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChapterPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/lib/book", () => ({
  getChapter: (n: number) =>
    n === 1
      ? {
          number: 1,
          title: "Arrival",
          volume: "VOLUME ONE",
          content: "On the 24th of February, 1815...",
        }
      : undefined,
  getBookIndex: () => ({
    chapters: [{ number: 1 }, { number: 2 }],
  }),
  VOLUME_LABELS: { "VOLUME ONE": "Volume I" },
}));

vi.mock("@/lib/chapter-index", () => ({
  getChapterIndexEntry: () => ({
    number: 1,
    entities: [],
    scenes: [],
  }),
}));

vi.mock("@/lib/characters", () => ({ getCharacter: () => undefined }));
vi.mock("@/lib/entities", () => ({ getPlaceOrEvent: () => undefined }));
vi.mock("@/lib/entity-store", () => ({ getStoredEntity: () => undefined }));
vi.mock("@/lib/scenes", () => ({ getParagraphs: (c: string) => c.split(/\n\n+/).filter(Boolean) }));
vi.mock("@/lib/linkify", () => ({
  linkifyParagraph: (p: string) => [{ type: "text" as const, content: p }],
}));

describe("app/chapter/[number]/page", () => {
  it("renders chapter content", async () => {
    const Page = await ChapterPage({ params: Promise.resolve({ number: "1" }) });
    render(Page);
    expect(screen.getByText("Chapter 1")).toBeInTheDocument();
    expect(screen.getByText("Arrival")).toBeInTheDocument();
  });
});
