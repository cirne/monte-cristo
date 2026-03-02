import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import Home from "./page";

vi.mock("@/lib/books", () => ({
  BOOK_SLUGS: ["monte-cristo", "gatsby"] as const,
  getBookConfig: (slug: string) =>
    slug === "monte-cristo"
      ? { title: "The Count of Monte Cristo", author: "Alexandre Dumas, père" }
      : slug === "gatsby"
        ? { title: "The Great Gatsby", author: "F. Scott Fitzgerald" }
        : undefined,
}));

vi.mock("./components/StartOrContinueLink", () => ({
  StartOrContinueLink: () => <Link href="/book/monte-cristo/chapter/1">Start Reading</Link>,
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
