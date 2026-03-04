import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout from "./layout";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ back: vi.fn() }),
}));

describe("app/layout", () => {
  it("renders children", () => {
    render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>
    );
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders footer with source link", () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>
    );
    expect(screen.getByText(/Project Gutenberg/)).toBeInTheDocument();
  });
});
