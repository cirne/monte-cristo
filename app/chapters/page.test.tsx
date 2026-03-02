import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import LegacyChaptersPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("app/chapters/page", () => {
  it("redirects to default book chapters", async () => {
    const { redirect } = await import("next/navigation");
    try {
      render(<LegacyChaptersPage />);
    } catch {
      // redirect() may throw
    }
    expect(redirect).toHaveBeenCalledWith("/book/monte-cristo/chapters");
  });
});
