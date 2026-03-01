import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { XRayPanel } from "./XRayPanel";

describe("app/chapter/[number]/XRayPanel", () => {
  it("returns null when entityId is null", () => {
    const { container } = render(
      <XRayPanel
        entityId={null}
        entityData={{}}
        chapterNumber={1}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when entity not in entityData", () => {
    const { container } = render(
      <XRayPanel
        entityId="unknown"
        entityData={{}}
        chapterNumber={1}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders entity name and intro when entity is selected", () => {
    render(
      <XRayPanel
        entityId="dantes"
        entityData={{
          dantes: {
            name: "Edmond Dantès",
            aliases: [],
            spoilerFreeIntro: "A young sailor.",
            firstSeenInChapter: 1,
            type: "person",
          },
        }}
        chapterNumber={1}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Edmond Dantès")).toBeInTheDocument();
    expect(screen.getByText(/A young sailor/)).toBeInTheDocument();
  });
});
