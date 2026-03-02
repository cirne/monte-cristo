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
    expect(screen.getByLabelText("Table of Contents")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("shows chapter number when on chapter page", () => {
    render(<HeaderNav />);
    expect(screen.getByText("Ch. 5")).toBeInTheDocument();
  });

  it("chapter number link goes to table of contents", () => {
    render(<HeaderNav />);
    const tocLink = screen.getByLabelText("Open table of contents");
    expect(tocLink).toHaveAttribute("href", "/book/monte-cristo/chapters");
    expect(tocLink).toHaveTextContent("Ch. 5");
  });
});
