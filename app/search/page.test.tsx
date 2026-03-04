import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { redirect } from "next/navigation";
import SearchPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("app/search/page", () => {
  it("redirects to default book search", () => {
    try {
      render(<SearchPage />);
    } catch {
      // redirect() throws NEXT_REDIRECT in real Next.js
    }
    expect(redirect).toHaveBeenCalledWith("/book/monte-cristo/search");
  });
});
