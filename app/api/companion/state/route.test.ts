import { describe, it, expect, vi } from "vitest";
import { GET, OPTIONS } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/companion-hosted-link", () => ({
  resolveHostedReaderUrl: () => "/book/monte-cristo",
}));

vi.mock("@/lib/companion-ingest", () => ({
  getCompanionState: vi.fn(({ title }: { title: string }) => ({
    bookTitle: title,
    bookId: "title-test",
    indexing: false,
    chunkCount: 0,
    entities: [],
    currentSummary: null,
    storySoFar: null,
    hostedReaderUrl: "/book/monte-cristo",
    message: "No companion notes yet",
  })),
}));

function createRequest(params: Record<string, string>): NextRequest {
  const search = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/companion/state?${search}`);
}

describe("app/api/companion/state/route", () => {
  it("responds to preflight with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });

  it("returns 400 when title is missing", async () => {
    const res = await GET(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns panel state", async () => {
    const res = await GET(createRequest({ title: "The Count of Monte Cristo" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hostedReaderUrl).toBe("/book/monte-cristo");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
