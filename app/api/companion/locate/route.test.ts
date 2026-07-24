import { describe, it, expect, vi } from "vitest";
import { GET, OPTIONS } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/books", () => ({
  BOOK_SLUGS: ["monte-cristo", "gatsby"],
}));

vi.mock("@/lib/book", () => ({
  getBookConfig: (slug: string) =>
    slug === "monte-cristo"
      ? { title: "The Count of Monte Cristo", author: "Alexandre Dumas, père" }
      : { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  getBookIndex: () => ({ chapters: [{ number: 1 }, { number: 2 }] }),
  getBook: () => ({
    chapters: [
      {
        number: 1,
        title: "Marseilles—The Arrival",
        volume: "VOLUME ONE",
        content:
          "On the 24th of February, 1815, the look-out at Notre-Dame de la Garde signalled the three-master, the Pharaon.\n\nAs usual, a pilot put off immediately, and rounding the Château d’If, got on board the vessel.",
      },
      {
        number: 2,
        title: "Father and Son",
        volume: "VOLUME ONE",
        content:
          "We will leave Danglars struggling with the demon of hatred.\n\nDantès, after having traversed La Canebière, took the Rue de Noailles.",
      },
    ],
  }),
}));

function createRequest(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/companion/locate?${search}`);
}

describe("app/api/companion/locate/route", () => {
  it("responds to preflight with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 when title is missing", async () => {
    const res = await GET(createRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.found).toBe(false);
  });

  it("returns found=false for an unknown book", async () => {
    const res = await GET(createRequest({ title: "Moby-Dick" }));
    const data = await res.json();
    expect(data.found).toBe(false);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("matches a decorated Kindle title and returns the book url", async () => {
    const res = await GET(
      createRequest({ title: "The Count of Monte Cristo (AmazonClassics Edition)" })
    );
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.slug).toBe("monte-cristo");
    expect(data.url).toBe("/book/monte-cristo");
    expect(data.chapter).toBeNull();
  });

  it("locates visible text to a chapter + paragraph deep link", async () => {
    const res = await GET(
      createRequest({
        title: "The Count of Monte Cristo",
        text: "Dantès, after having traversed La Canebière, took the Rue de Noailles.",
      })
    );
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.chapter).toBe(2);
    expect(data.paragraph).toBe(1);
    expect(data.url).toBe("/book/monte-cristo/chapter/2?paragraph=1");
  });

  it("falls back to the book url when text does not match", async () => {
    const res = await GET(
      createRequest({
        title: "The Count of Monte Cristo",
        text: "Call me Ishmael. Some years ago, never mind how long precisely.",
      })
    );
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.url).toBe("/book/monte-cristo");
  });
});
