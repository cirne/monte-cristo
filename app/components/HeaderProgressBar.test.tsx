import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { HeaderProgressBar } from "./HeaderProgressBar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/chapter/50",
}));

describe("app/components/HeaderProgressBar", () => {
  it("renders progress bar container", () => {
    const { container } = render(<HeaderProgressBar />);
    expect(container.querySelector(".bg-stone-200")).toBeInTheDocument();
  });
});
