import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("links other entities inside intro text", () => {
    const onSelectEntity = vi.fn();
    render(
      <XRayPanel
        entityId="dantes"
        entityData={{
          dantes: {
            name: "Edmond Dantès",
            aliases: [],
            spoilerFreeIntro: "Edmond Dantès is devoted to Mercédès.",
            firstSeenInChapter: 1,
            type: "person",
          },
          mercedes: {
            name: "Mercédès",
            aliases: [],
            spoilerFreeIntro: "Dantès's fiancee.",
            firstSeenInChapter: 1,
            type: "person",
          },
        }}
        chapterNumber={1}
        onClose={vi.fn()}
        onSelectEntity={onSelectEntity}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mercédès" }));
    expect(onSelectEntity).toHaveBeenCalledWith("mercedes");
  });
});
