import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderNav } from "./HeaderNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/book/monte-cristo/chapter/5",
  useRouter: () => ({ back: vi.fn() }),
}));

describe("app/components/HeaderNav", () => {
  it("renders navigation links", () => {
    render(<HeaderNav />);
    expect(screen.getByLabelText("Monte Cristo Reader")).toBeInTheDocument();
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("shows chapter number when on chapter page", () => {
    render(<HeaderNav />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("chapter number link goes to book home", () => {
    render(<HeaderNav />);
    const tocLink = screen.getByLabelText("Book home");
    expect(tocLink).toHaveAttribute("href", "/book/monte-cristo");
    expect(tocLink).toHaveTextContent("5");
  });
});
