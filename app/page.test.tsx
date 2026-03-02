import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Link from "next/link";
import Home from "./page";

vi.mock("@/lib/books", () => ({
  BOOK_SLUGS: ["monte-cristo", "gatsby"] as const,
  getBookConfig: (slug: string) =>
    slug === "monte-cristo"
      ? { title: "The Count of Monte Cristo", author: "Alexandre Dumas, père", storageKey: "mc-last-chapter" }
      : slug === "gatsby"
        ? { title: "The Great Gatsby", author: "F. Scott Fitzgerald", storageKey: "gatsby-last-chapter" }
        : undefined,
}));

vi.mock("@/lib/book", () => ({
  getBookIndex: () => ({ chapters: [{ number: 1, title: "Ch 1", volume: "" }] }),
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
    expect(screen.getByText(/Great literature for the short-attention generation/)).toBeInTheDocument();
    expect(screen.getByText("The Count of Monte Cristo")).toBeInTheDocument();
    expect(screen.getByText("The Great Gatsby")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Table of Contents/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /Start Reading/i }).length).toBeGreaterThanOrEqual(1);
  });
});
