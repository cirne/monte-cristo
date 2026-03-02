import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ParagraphContextMenu } from "./ParagraphContextMenu";

describe("app/chapter/[number]/ParagraphContextMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders two actions when opened", () => {
    render(
      <ParagraphContextMenu
        anchor={{ x: 120, y: 120, paragraphIndex: 4 }}
        chapterNumber={3}
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Explain current scene" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summarize story so far" })).toBeInTheDocument();
  });

  it("calls current-scene API and renders answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "The scene is focused on immediate conflict and decision-making." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ParagraphContextMenu
        anchor={{ x: 120, y: 120, paragraphIndex: 7 }}
        chapterNumber={5}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Explain current scene" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/context/current-scene?chapter=5&paragraph=7"
      );
    });
    expect(
      await screen.findByText("The scene is focused on immediate conflict and decision-making.")
    ).toBeInTheDocument();
  });

  it("closes when clicking outside", () => {
    const onClose = vi.fn();
    render(
      <ParagraphContextMenu
        anchor={{ x: 120, y: 120, paragraphIndex: 1 }}
        chapterNumber={2}
        onClose={onClose}
      />
    );

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens selected entity when clicking linked name in summary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: "Edmond Dantès reunites with Mercédès." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();
    const onOpenEntity = vi.fn();

    render(
      <ParagraphContextMenu
        anchor={{ x: 120, y: 120, paragraphIndex: 2 }}
        chapterNumber={4}
        onClose={onClose}
        onOpenEntity={onOpenEntity}
        entityData={{
          dantes: {
            name: "Edmond Dantès",
            aliases: [],
            firstSeenInChapter: 1,
            type: "person",
          },
          mercedes: {
            name: "Mercédès",
            aliases: [],
            firstSeenInChapter: 1,
            type: "person",
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Summarize story so far" }));
    const mercedesLink = await screen.findByRole("button", { name: "Mercédès" });
    fireEvent.click(mercedesLink);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenEntity).toHaveBeenCalledWith("mercedes");
  });
});
