import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StartOrContinueLink } from "./StartOrContinueLink";

describe("app/components/StartOrContinueLink", () => {
  it("renders a link", () => {
    render(<StartOrContinueLink />);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toMatch(/\/chapter\//);
  });

  it("shows Start Reading or Continue Reading", () => {
    render(<StartOrContinueLink />);
    const link = screen.getByRole("link");
    expect(
      link.textContent === "Start Reading" || link.textContent === "Continue Reading"
    ).toBe(true);
  });
});
