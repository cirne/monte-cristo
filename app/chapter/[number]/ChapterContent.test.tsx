import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
  });

  it("renders link segments as buttons", () => {
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
        xrayData={{}}
      />
    );
    expect(screen.getByText("Dantès")).toBeInTheDocument();
  });
});
