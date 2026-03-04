import { describe, it, expect, vi } from "vitest";
import ChapterPage from "./page";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error("redirect");
  },
}));

vi.mock("@/lib/books", () => ({ DEFAULT_BOOK_SLUG: "monte-cristo" }));

describe("app/chapter/[number]/page", () => {
  it("redirects to book slug chapter route", async () => {
    redirectMock.mockClear();
    try {
      await ChapterPage({ params: Promise.resolve({ number: "1" }) });
    } catch (e) {
      expect((e as Error).message).toBe("redirect");
    }
    expect(redirectMock).toHaveBeenCalledWith("/book/monte-cristo/chapter/1");
  });
});
