import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import Home from "./page";

vi.mock("@/lib/book", () => ({
  getBookIndex: () => ({
    title: "The Count of Monte Cristo",
    author: "Alexandre Dumas",
    chapters: [
      { number: 1, title: "Chapter 1", volume: "VOLUME ONE" },
      { number: 2, title: "Chapter 2", volume: "VOLUME ONE" },
    ],
  }),
  VOLUME_LABELS: { "VOLUME ONE": "Volume I" },
}));

vi.mock("./components/StartOrContinueLink", () => ({
  StartOrContinueLink: () => <Link href="/chapter/1">Start Reading</Link>,
}));

describe("app/page", () => {
  it("renders the book title", () => {
    render(<Home />);
    expect(screen.getByText("The Count of Monte Cristo")).toBeInTheDocument();
  });

  it("renders author", () => {
    render(<Home />);
    expect(screen.getByText("Alexandre Dumas, père")).toBeInTheDocument();
  });

  it("renders book cards to pick a book", () => {
    render(<Home />);
    expect(screen.getByText("Pick a book to start reading with X-Ray style context.")).toBeInTheDocument();
    expect(screen.getByText("The Count of Monte Cristo")).toBeInTheDocument();
    expect(screen.getByText("The Great Gatsby")).toBeInTheDocument();
    expect(screen.getAllByText(/Open book →/).length).toBeGreaterThanOrEqual(1);
  });
});
