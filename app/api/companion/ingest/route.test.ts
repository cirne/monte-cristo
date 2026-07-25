import { describe, it, expect, vi } from "vitest";
import { POST, OPTIONS } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/companion-hosted-link", () => ({
  resolveHostedReaderUrl: () => null,
}));

vi.mock("@/lib/companion-ingest", () => ({
  ingestCompanionChunk: vi.fn(async ({ title }: { title: string }) => ({
    bookTitle: title,
    bookId: "title-test",
    indexing: false,
    chunkCount: 1,
    entities: [{ id: "leto", name: "Leto II", type: "person" }],
    currentSummary: "Summary",
    storySoFar: "So far",
    hostedReaderUrl: null,
  })),
}));

function createPost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/companion/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("app/api/companion/ingest/route", () => {
  it("responds to preflight with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(createPost({ text: "some page text" }));
    expect(res.status).toBe(400);
  });

  it("returns panel state for a valid ingest", async () => {
    const res = await POST(
      createPost({
        title: "God Emperor of Dune",
        text: "Leto stood on the dune considering the Golden Path ahead of him today.",
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookTitle).toBe("God Emperor of Dune");
    expect(data.entities[0].name).toBe("Leto II");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
