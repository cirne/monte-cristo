import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CharactersPage from "./page";

vi.mock("@/lib/book", () => ({
  getBook: () => ({
    chapters: [
      { number: 1, content: "Dantès sailed the Pharaon.", title: "Ch1", volume: "VOLUME ONE" },
    ],
  }),
}));

vi.mock("@/lib/characters", () => ({
  CHARACTERS: [
    {
      id: "dantes",
      name: "Edmond Dantès",
      aliases: [],
      description: "The protagonist.",
      searchTerms: ["Dantès"],
      role: "protagonist",
    },
  ],
}));

describe("app/characters/page", () => {
  it("renders Character Guide title", () => {
    render(<CharactersPage />);
    expect(screen.getByText("Character Guide")).toBeInTheDocument();
  });

  it("renders character names", () => {
    render(<CharactersPage />);
    expect(screen.getByText("Edmond Dantès")).toBeInTheDocument();
  });
});
