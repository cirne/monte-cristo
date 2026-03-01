import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SearchPage from "./page";

describe("app/search/page", () => {
  it("renders search page title", () => {
    render(<SearchPage />);
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<SearchPage />);
    expect(
      screen.getByPlaceholderText(/Search chapters, characters, places/)
    ).toBeInTheDocument();
  });

  it("shows hint for short query", () => {
    render(<SearchPage />);
    expect(screen.getByText(/Type at least 2 characters/)).toBeInTheDocument();
  });
});
