import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReaderFooter } from "./ReaderFooter";

describe("app/chapter/[number]/ReaderFooter", () => {
  it("returns null when no location and no character ids", () => {
    const { container } = render(
      <ReaderFooter
        locationLabel={null}
        visibleCharacterIds={[]}
        xrayData={{}}
        onOpenEntity={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders location label when provided", () => {
    render(
      <ReaderFooter
        locationLabel="On the deck of the Pharaon"
        visibleCharacterIds={[]}
        xrayData={{}}
        onOpenEntity={vi.fn()}
      />
    );
    expect(screen.getByText("On the deck of the Pharaon")).toBeInTheDocument();
  });
});
