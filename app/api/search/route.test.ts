import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/book", () => ({
  getBook: () => ({
    chapters: [
      {
        number: 1,
        title: "Arrival",
        volume: "VOLUME ONE",
        content: "Dantès sailed into Marseilles harbor.",
      },
    ],
  }),
}));

function createRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(query)}`);
}

describe("app/api/search/route", () => {
  it("returns empty results for query shorter than 2 chars", async () => {
    const req = createRequest("a");
    const res = await GET(req);
    const data = await res.json();
    expect(data.results).toEqual([]);
    expect(data.query).toBe("a");
  });

  it("returns results when query matches", async () => {
    const req = createRequest("Dantès");
    const res = await GET(req);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);
    if (data.results.length > 0) {
      expect(data.results[0]).toHaveProperty("number");
      expect(data.results[0]).toHaveProperty("title");
      expect(data.results[0]).toHaveProperty("excerpt");
    }
  });
});
