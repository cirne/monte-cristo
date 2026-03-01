import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ChaptersPage from "./page";

vi.mock("@/lib/book", () => ({
  getBookIndex: () => ({
    chapters: [
      { number: 1, title: "Arrival", volume: "VOLUME ONE" },
      { number: 2, title: "Father and Son", volume: "VOLUME ONE" },
    ],
  }),
  VOLUME_LABELS: { "VOLUME ONE": "Volume I" },
}));

describe("app/chapters/page", () => {
  it("renders page title", () => {
    render(<ChaptersPage />);
    expect(screen.getByText("All Chapters")).toBeInTheDocument();
  });

  it("renders chapter links", () => {
    render(<ChaptersPage />);
    expect(screen.getByText("Arrival")).toBeInTheDocument();
    expect(screen.getByText("Father and Son")).toBeInTheDocument();
  });
});
