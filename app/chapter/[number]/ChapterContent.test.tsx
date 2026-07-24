import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChapterContent } from "./ChapterContent";

describe("app/chapter/[number]/ChapterContent", () => {
  it("renders paragraph segments", () => {
    render(
      <ChapterContent
        paragraphSegments={[[{ type: "text", content: "First paragraph." }]]}
        scenes={[]}
        chapterNumber={1}
        xrayData={{}}
      />
    );
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    const paragraph = screen.getByText("First paragraph.").closest("p");
    expect(paragraph).toBeTruthy();
    fireEvent.click(paragraph!);
    expect(screen.getByRole("button", { name: "Explain current scene" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summarize story so far" })).toBeInTheDocument();
  });

  it("does not open context menu when clicking an entity link", () => {
    render(
      <ChapterContent
        paragraphSegments={[
          [
            { type: "text", content: "Hello " },
            {
              type: "link",
              content: "Dantès",
              entityId: "dantes",
              entityType: "person",
            },
          ],
        ]}
        scenes={[]}
        chapterNumber={1}
        xrayData={{
          dantes: {
            name: "Edmond Dantès",
            aliases: [],
            firstSeenInChapter: 1,
            type: "person",
          },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Dantès" }));
    expect(screen.getByRole("heading", { name: "Edmond Dantès", level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explain current scene" })).not.toBeInTheDocument();
  });

  it("scrolls to and highlights the paragraph from scrollToParagraphIndex", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <ChapterContent
        paragraphSegments={[
          [{ type: "text", content: "First paragraph." }],
          [{ type: "text", content: "Second paragraph." }],
        ]}
        scenes={[]}
        chapterNumber={1}
        xrayData={{}}
        scrollToParagraphIndex={1}
      />
    );
    const target = screen.getByText("Second paragraph.").closest("p")!;
    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
      expect(target.getAttribute("data-scroll-to-highlight")).toBe("true");
    });
  });
});
