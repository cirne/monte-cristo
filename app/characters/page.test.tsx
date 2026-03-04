import { describe, it, expect, vi } from "vitest";
import CharactersPage from "./page";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("redirect");
  },
}));

vi.mock("@/lib/books", () => ({ DEFAULT_BOOK_SLUG: "monte-cristo" }));

describe("app/characters/page", () => {
  it("redirects to book characters route", () => {
    redirectMock.mockClear();
    try {
      CharactersPage({});
    } catch (e) {
      expect((e as Error).message).toBe("redirect");
    }
    expect(redirectMock).toHaveBeenCalledWith("/book/monte-cristo/characters");
  });
});
